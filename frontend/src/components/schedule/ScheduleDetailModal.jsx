/**
 * ScheduleDetailModal — bottom-sheet modal with full upcoming schedule.
 * - 세로 리스트 + "다음" 배지 + "N분 뒤"
 * - 모바일: ui/Sheet(백드롭·Escape·포커스 트랩·z 토큰을 위임, 예전 vaul 기반
 *   스와이프 다운 닫기는 제거). PC: 좌측 패널 내 콘텐츠 교체형 크로스페이드
 *   (기존 UX 유지 — 오프캔버스 슬라이드가 아니라 Sheet의 bottom/center 배치로는
 *   표현할 수 없는 도킹 패널이라 Sheet를 쓰지 않는다).
 * - FloatingDock 위로 띄워지도록 bottom padding 확보
 * - pcMode="overlay"(기본, GlobalDetailModal 용) — PCMainShell 좌측 38% 패널 위에
 *   fixed portal로 뜬다(맵 홈 전용 geometry 가정).
 *   pcMode="inline"(SchedulePage PC 2열 레이아웃 전용) — portal/fixed 없이 부모가 준
 *   컨테이너를 그대로 채운다(Phase D PC · 시간표).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, Star, MapPin, LayoutGrid, List } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useBusTimetable, useBusTimetableByRoute, useBusHistoryPreview, useBusArrivalStats, useBusCommuteContexts } from '../../hooks/useBus'
import { useShuttleSchedule, useShuttlePeriods } from '../../hooks/useShuttle'
import { useSubwayTimetable } from '../../hooks/useSubway'
import { useIsNarrowPhone } from '../../hooks/useMediaQuery'
import { useShuttleAlarms } from '../../hooks/useShuttleNotification'
import Skeleton from '../common/Skeleton'
import Sheet from '../ui/Sheet'
import IconButton from '../ui/IconButton'
import ErrorState from '../ui/ErrorState'
import { RouteProgressStrip } from '../bus/BusArrivalCard'
import { ROUTE_WAYPOINTS, getGbisStationIdForRoute, getRouteDisplayConfig } from '../dashboard/busStationConfig'
import BusStatsHeader from '../bus/BusStatsHeader'
import BusEtaCard from '../bus/BusEtaCard'
import { scrollToCenter } from '../../utils/scrollToCenter'
import ShuttleNotifySheet from '../shuttle/ShuttleNotifySheet'
import { BellButton, NarrowPhoneStrip } from '../shuttle/ShuttleTimetable'
import { buildDisplayList, DIRECTION_LABELS, annotateShuttleEntries, buildShuttleGroups } from '../shuttle/shuttleSchedule'
import ShuttleTimetableGroups from '../shuttle/ShuttleTimetableGroups'
import HourGroupTimetable from './HourGroupTimetable'
import { canSubmitBusSignal, submitBusSignal } from '../../hooks/useBusReports'
import {
  PERIOD_VARIANTS,
  periodVariantKey,
  periodRangeLabel,
  pickCurrentPeriod,
  representativeWeekday,
  shortPeriodName,
  variantsInTimes,
  visiblePeriods,
} from '../shuttle/shuttlePeriods'
import SegmentedControl from '../ui/SegmentedControl'
import { BUS_COMMUTE_GROUPS } from '../../utils/busCommuteContext'

/**
 * 셔틀 알림(종 버튼 + 예약 시트) 노출 스위치.
 *
 * 실기기에서 예약이 동작하지 않아 2026-08에 화면에서 내렸다. 훅·시트·버튼 코드는
 * 지우지 않고 이 플래그로만 끈다 — 푸시 배선(서비스워커 스케줄링)이 끝나면
 * true 로 되돌리는 것으로 복구된다. 관련 테스트도 이 플래그를 보고 skip한다.
 */
export const SHUTTLE_ALARM_ENABLED = false

// ─── helpers ────────────────────────────────────────────────────────────

function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function minutesUntil(hhmm, now = new Date()) {
  const [h, m] = (hhmm ?? '00:00').split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 60000)
}

function fmtDelta(mins) {
  if (mins <= 0) return '곧 출발'
  if (mins < 60) return `${mins}분 뒤`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`
}

function scheduleTypeLabel(type) {
  return type === 'weekday' ? '평일' : type === 'saturday' ? '토요일' : '일/공휴일'
}

// ─── shared list row ────────────────────────────────────────────────────

function TimeGrid({ times }) {
  if (!times.length) return null
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {times.map((t, i) => (
        <div
          key={`${t}-${i}`}
          className="text-center py-2 px-1 rounded-mini bg-surface-2 dark:bg-bg text-sm font-bold text-ink-2 dark:text-ink-2 tabular-nums"
        >
          {t}
        </div>
      ))}
    </div>
  )
}

// ─── 그리드 뷰 (Phase D — DESIGN.md 시안 "시간표 · A") ────────────────────
// 리스트 뷰(HourGroupTimetable)와 같은 오늘 전체 시각을 4열 그리드로 보여준다.
// 다음 차만 accent 채움, 지난 시각은 흐리게 — 인라인 반올림/포맷 로직 없이
// 순수 표시 전용(날짜 계산은 각 Content 컴포넌트가 기존 헬퍼로 미리 끝낸다).
export function TimeGridView({ items, gridRef }) {
  if (!items.length) return null
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((it) => (
        <div
          key={it.key}
          ref={it.isNext ? gridRef : undefined}
          className={`relative text-center py-2.5 px-1 rounded-mini text-sm font-semibold tabular-nums tracking-tight transition-colors ${
            it.isNext
              ? 'bg-accent dark:bg-accent text-white font-bold'
              : it.isPast
                ? 'bg-transparent text-mute dark:text-mute'
                : 'bg-surface-2 dark:bg-bg text-ink-2 dark:text-ink-2'
          }`}
        >
          {it.time}
          {it.isLast && !it.isNext && (
            <span className="absolute -top-1.5 -right-1 text-micro font-bold px-1 rounded-full bg-ink dark:bg-line-strong text-white dark:text-ink leading-tight">
              막차
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// 그리드 뷰 하단 "다음 차 HH:MM · N분 후" 요약 — 기존 minutesUntil/fmtDelta 재사용(반올림 로직 인라인 복제 금지).
function NextMeta({ nextTime }) {
  if (!nextTime) return null
  const mins = Math.max(0, minutesUntil(nextTime))
  return (
    <p className="text-caption text-mute dark:text-mute mt-2.5 mb-0.5 px-0.5">
      다음 차 <b className="text-accent-ink dark:text-accent font-bold">{nextTime}</b> · {fmtDelta(mins)}
    </p>
  )
}

// 리스트/그리드 전환 세그 버튼. DESIGN.md 시안의 sc-viewseg 대응.
// TODO(F3): 선택 상태를 zustand persist로 이관(설정 화면의 "시간표 보기" 기본값과 연동).
// 지금은 모달을 열 때마다 'list'로 초기화되는 로컬 state.
function ViewModeToggle({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="시간표 보기 방식"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-button bg-surface-2 dark:bg-bg border border-line dark:border-line flex-shrink-0"
    >
      {[
        { id: 'grid', label: '그리드', Icon: LayoutGrid },
        { id: 'list', label: '리스트', Icon: List },
      ].map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            aria-label={`${label}로 보기`}
            title={`${label}로 보기`}
            className={`pressable flex items-center justify-center w-8 h-8 rounded-mini transition-colors ${
              active
                ? 'bg-surface dark:bg-surface-2 text-ink dark:text-ink shadow-sh-card'
                : 'text-mute dark:text-mute'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

// ─── per-type content ───────────────────────────────────────────────────

function BusContent({ routeCode, routeId = null, stopId = null, category = null, viewMode = 'list', scrollContainerRef }) {
  // routeId가 있으면 방향 정확한 /bus/timetable/{route_id} 사용 (등교/하교 분리 route에 필수)
  const useScopedRoute = stopId != null || category != null
  const byId    = useBusTimetable(useScopedRoute ? null : routeId)
  const byRoute = useBusTimetableByRoute(useScopedRoute || routeId == null ? routeCode : null, {
    stopId: stopId ?? undefined,
    category: category ?? undefined,
  })
  const { data, loading, error, refetch } = useScopedRoute || routeId == null ? byRoute : byId
  const nextRef = useRef(null)
  const now = new Date()
  const allTimes = data?.times ?? []
  // Date 기반 비교: 자정 이후 00:xx 시간대를 문자열 비교가 미래로 잘못 잡는 버그 방지
  // 12h 필터 없음 — 상세 모달은 당일 시간표 전체를 표시하므로 단순 미래 여부만 판단
  const firstFutureIdx = allTimes.findIndex((t) => {
    const [h, m] = (t ?? '').split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d > now
  })
  const futureCount = firstFutureIdx === -1 ? 0 : allTimes.length - firstFutureIdx

  useEffect(() => {
    scrollToCenter(scrollContainerRef?.current, nextRef.current)
  }, [data, scrollContainerRef])

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg onRetry={refetch} />
  if (!allTimes.length) return <EmptyMsg text="오늘 운행 정보가 없어요" />

  const items = allTimes.map((t, i) => {
    const [th, tm] = (t ?? '').split(':').map(Number)
    const td = new Date(now)
    if (!Number.isNaN(th) && !Number.isNaN(tm)) td.setHours(th, tm, 0, 0)
    return {
      key: `${t}-${i}`,
      time: t,
      isPast: td <= now,
      isNext: i === firstFutureIdx,
      isLast: i === allTimes.length - 1,
    }
  })

  return (
    <div className="flex flex-col gap-2">
      {/* 남은 차가 0이면 목록만 보고는 "지난 시각뿐"인지 "데이터가 이상한지" 구분이
          안 된다. 상단에 상태를 먼저 말하고 내일 첫차까지 준다. */}
      {futureCount === 0 && (
        <div className="mb-1 px-3.5 py-2.5 rounded-card bg-imminent-bg dark:bg-imminent-bg">
          <p className="text-label font-bold text-imminent dark:text-imminent">
            오늘 운행이 끝났어요
          </p>
          <p className="text-caption font-semibold text-mute dark:text-mute mt-0.5">
            막차 {allTimes[allTimes.length - 1]} 출발 · 내일 첫차 {allTimes[0]}
          </p>
        </div>
      )}
      {data?.schedule_type && (
        <p className="text-caption text-mute mb-1">
          {scheduleTypeLabel(data.schedule_type)} 시간표 · 첫차 {allTimes[0]} ~ 막차 {allTimes[allTimes.length - 1]} · 총 {allTimes.length}회 · 남은 {futureCount}회
        </p>
      )}
      {/* 승차 위치 — 셔틀의 SHUTTLE_BOARDING_INFO와 같은 자리. 셔틀은 방향별 하드코딩이지만
          버스는 백엔드가 이 노선에 연결된 기점 정류장명(origin_stop_name)을 이미 내려준다
          (RouteDetailPage가 같은 필드를 "OO 출발 시각"으로 이미 쓰고 있다 — 지어낸 값이 아님).
          stopId를 이미 넘겨받은 호출(BusContextDetail의 source 블록)은 그 위에서 같은 정보를
          "OO 승차" 헤더로 이미 보여주므로 여기서는 중복하지 않는다. */}
      {stopId == null && data?.origin_stop_name && (
        <p className="flex items-start gap-1.5 px-1 mb-1 text-caption font-medium text-mute dark:text-mute leading-snug">
          <MapPin size={13} aria-hidden className="mt-0.5 flex-shrink-0" />
          {data.origin_stop_name} 승차
        </p>
      )}
      {viewMode === 'grid' ? (
        <>
          <TimeGridView items={items} gridRef={nextRef} />
          <NextMeta nextTime={allTimes[firstFutureIdx] ?? null} />
        </>
      ) : (
        <HourGroupTimetable items={items} now={now} nextRef={nextRef} />
      )}
      <BusReportRow routeNo={routeCode} stationKey={stopId} />
    </div>
  )
}

// F6 — 만차·결행 제보 행. 제보는 30분간 같은 정류장 카드에 경고 칩으로 공유된다.
// 기기당 (노선, 종류) 10분 1회 로컬 스로틀(useBusReports)로 어뷰즈를 완충한다.
function BusReportRow({ routeNo, stationKey }) {
  const [sentKind, setSentKind] = useState(null)
  if (!stationKey || !routeNo) return null

  const send = async (kind) => {
    setSentKind(kind)
    if (!canSubmitBusSignal(routeNo, kind)) return // 이미 제보함 — UI만 완료 표시
    try {
      await submitBusSignal(kind, routeNo, stationKey)
    } catch {
      // rate limit 등 — 제보 UX는 성공처럼 조용히 처리(서버가 이미 과다 요청을 막았다)
    }
  }

  if (sentKind) {
    return (
      <p className="mt-2 px-1 text-caption font-semibold text-accent-ink dark:text-accent-ink">
        제보 완료 · 30분 동안 다른 사람 카드에 표시돼요
      </p>
    )
  }

  return (
    <div className="mt-2 pt-3 border-t border-line dark:border-line">
      <p className="px-1 mb-2 text-caption font-medium text-mute dark:text-mute">
        지금 상황 제보 · 익명, 30분 뒤 자동 삭제
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => send('bus_full')}
          className="pressable flex-1 py-2.5 rounded-button bg-surface-2 dark:bg-surface-2 text-ink-2 dark:text-ink-2 text-caption font-bold"
        >
          만차로 지나갔어요
        </button>
        <button
          type="button"
          onClick={() => send('bus_no_show')}
          className="pressable flex-1 py-2.5 rounded-button bg-surface-2 dark:bg-surface-2 text-ink-2 dark:text-ink-2 text-caption font-bold"
        >
          시간 지나도 안 와요
        </button>
      </div>
    </div>
  )
}

// subwayKey → { dataKey, label }
const SUBWAY_KEY_META = {
  up:         { dataKey: 'up',         label: '상행 (왕십리 방면)' },
  down:       { dataKey: 'down',       label: '하행 (인천 방면)' },
  line4_up:   { dataKey: 'line4_up',   label: '상행' },
  line4_down: { dataKey: 'line4_down', label: '하행' },
  choji_up:   { dataKey: 'choji_up',   label: '상행 (소사 방면)' },
  choji_dn:   { dataKey: 'choji_dn',   label: '하행 (원시 방면)' },
  siheung_up: { dataKey: 'siheung_up', label: '상행 (소사 방면)' },
  siheung_dn: { dataKey: 'siheung_dn', label: '하행 (원시 방면)' },
}

function SubwayContent({ accentColor, subwayKey, viewMode = 'list', scrollContainerRef }) {
  const { data, loading, error, refetch } = useSubwayTimetable()
  const now = new Date()
  const nowStr = toHHMM(now)

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg onRetry={refetch} />
  if (!data) return <EmptyMsg text="시간표 정보가 없어요" />

  // 단일 방향 모드 (카드에서 특정 방향 클릭)
  if (subwayKey && SUBWAY_KEY_META[subwayKey]) {
    const { dataKey, label } = SUBWAY_KEY_META[subwayKey]
    const list = data[dataKey] ?? []
    const items = list.filter((t) => (t.depart_at ?? '') >= nowStr)
    return (
      <DirectionBlock
        label={label}
        allItems={list}
        items={items}
        accentColor={accentColor}
        viewMode={viewMode}
        nowStr={nowStr}
        scrollContainerRef={scrollContainerRef}
      />
    )
  }

  // 폴백: 양방향 (레거시)
  const upList = data.up ?? []
  const downList = data.down ?? []
  const upItems = upList.filter((t) => (t.depart_at ?? '') >= nowStr)
  const downItems = downList.filter((t) => (t.depart_at ?? '') >= nowStr)

  return (
    <div className="flex flex-col gap-5">
      <DirectionBlock
        label="상행 (왕십리 방면)"
        allItems={upList}
        items={upItems}
        accentColor={accentColor}
        viewMode={viewMode}
        nowStr={nowStr}
        scrollContainerRef={scrollContainerRef}
      />
      <DirectionBlock
        label="하행 (인천 방면)"
        allItems={downList}
        items={downItems}
        accentColor={accentColor}
        viewMode={viewMode}
        nowStr={nowStr}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
}

// 색은 이제 노선색 인라인이 아니라 토큰으로 그린다 — 넘겨받던 accentColor 는 쓰지 않는다.
function DirectionBlock({ label, allItems = [], items, viewMode = 'list', nowStr, scrollContainerRef }) {
  const nextRef = useRef(null)
  const allDone = items.length === 0
  const now = new Date()
  useEffect(() => {
    scrollToCenter(scrollContainerRef?.current, nextRef.current)
  }, [items.length, scrollContainerRef])

  // 하루 전체(과거+다음+이후) 항목 — 그리드 뷰와 새 시(hour) 그룹 리스트 뷰가 함께 쓴다.
  // allDone(금일 종료)일 땐 기존 TimeGrid(과거 전용) 그대로 사용.
  const firstFutureIdx = allItems.findIndex((t) => (t.depart_at ?? '') >= nowStr)
  const gridItems = allItems.map((t, i) => ({
    key: `${t.depart_at}-${i}`,
    time: t.depart_at,
    sub: t.destination,
    isPast: firstFutureIdx === -1 ? true : i < firstFutureIdx,
    isNext: i === firstFutureIdx,
    isLast: i === allItems.length - 1,
  }))

  return (
    <div>
      <p className="text-caption font-bold text-ink-2 dark:text-mute mb-2">
        {label} · 오늘 총 {allItems.length}편 중 {items.length}편 남음
      </p>
      {allDone && allItems.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-caption font-bold text-ink-2 dark:text-mute bg-surface-2 dark:bg-surface px-2 py-0.5 rounded-full">
            금일 운행 종료
          </span>
        </div>
      )}
      {allDone ? (
        <TimeGrid times={allItems.map((t) => t.depart_at)} />
      ) : viewMode === 'grid' ? (
        <>
          <TimeGridView items={gridItems} gridRef={nextRef} />
          <NextMeta nextTime={items[0]?.depart_at ?? null} />
        </>
      ) : (
        <HourGroupTimetable items={gridItems} now={now} nextRef={nextRef} />
      )}
    </div>
  )
}

// 셔틀이 미운행일에 빈 응답이면 다음 평일(월~금) 시간표를 폴백으로 보여줌.
// 본캠은 토·일 모두 미운행, 2캠(direction>=2)은 일요일만 미운행(토요일은 운행).
function isShuttleOffDay(direction, d = new Date()) {
  const day = d.getDay()
  if (direction >= 2) return day === 0
  return day === 0 || day === 6
}

function nextWeekdayDateStr() {
  const d = new Date()
  const day = d.getDay()
  const offset = day === 0 ? 1 : day === 6 ? 2 : 0
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 2캠 일요일에 토요일 시간표를 폴백으로 보여주기 위한 가장 가까운 직전 토요일 날짜.
function lastSaturdayDateStr() {
  const d = new Date()
  const day = d.getDay()
  // 일요일(0) → -1 (어제). 토요일/평일에는 호출하지 않는 경로.
  const offset = day === 0 ? -1 : 0
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 셔틀 승차 위치 안내 — 학교 시간표 PDF '셔틀버스 탑승 장소 안내' 페이지 기준.
// 처음 타는 사람이 가장 헤매는 정보라 시간표 위에 상시 노출한다.
const SHUTTLE_BOARDING_INFO = {
  0: '정왕역 셔틀 탑승장 승차 · 17시 이후는 파리바게뜨 건너편',
  1: '학교 하교 탑승장(정왕역 방향)에서 승차',
  2: '본교 산융관 앞 출발 · 첫차 09:00는 정왕역 꽃집앞 출발',
  3: '2캠퍼스 정문 승차장 승차 (정왕역·본교 방향 동일)',
}

function ShuttleContent({ direction, onDirectionChange, scrollContainerRef }) {
  const isSecondCampus = direction >= 2
  // 방향 전환 세그먼트는 시트 상단(헤더 아래)에서 렌더한다 — 버스 방면 셀렉터와
  // 같은 자리라 위치를 새로 배우지 않아도 된다. onDirectionChange는 그 세그먼트가
  // 쓰는 콜백이고, 이 컴포넌트는 넘겨받은 direction만 그린다.
  void onDirectionChange

  // 알림 예약 UI는 아직 실기기에서 동작하지 않아 화면에서 내렸다(2026-08).
  // 훅·시트·종 버튼 코드는 그대로 두고 렌더만 끈다 — 푸시 배선이 끝나면
  // SHUTTLE_ALARM_ENABLED 를 true 로 되돌리는 것으로 복구된다.
  const isNarrowPhone = useIsNarrowPhone()
  const { addAlarm, isAlarmSet } = useShuttleAlarms()
  const [sheetTime, setSheetTime] = useState(null)
  const openSheet = useCallback((time) => setSheetTime(time), [])
  const closeSheet = useCallback(() => setSheetTime(null), [])
  const handleConfirm = useCallback(
    (lead) => addAlarm(sheetTime, lead, direction),
    [addAlarm, sheetTime, direction]
  )
  // 등교 회차편의 하교 출발 시각 판정을 위해 양 방향을 한 번에 조회.
  // (direction 쿼리를 생략하면 백엔드가 양 방향을 함께 반환 — 로딩 경합 제거)
  const today = useShuttleSchedule()

  // ── 기간 전환 칩(D1) — 방학 시간표의 계절학기/단축근무/정상근무 색상 분류 ──
  // 디폴트는 오늘이 속한 기간. 다른 칩을 누르면 그 기간의 평일 시간표를
  // 미리보기로 조회한다(카운트다운·알림 종은 오늘 시간표에서만 의미가 있어 숨김).
  const periodsQuery = useShuttlePeriods()
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  // 칩 노이즈 방지 — 진행 중·미래·최근 종료(2주) 기간만 노출
  const periods = visiblePeriods(periodsQuery.data?.periods ?? [], todayStr)
  const currentPeriod = pickCurrentPeriod(periods, todayStr)
  const [selectedPeriodId, setSelectedPeriodId] = useState(null) // null = 오늘(현재 기간)
  const previewPeriod =
    selectedPeriodId != null && selectedPeriodId !== currentPeriod?.id
      ? periods.find((p) => p.id === selectedPeriodId) ?? null
      : null
  const previewing = previewPeriod != null
  const previewDate = previewing ? representativeWeekday(previewPeriod, todayStr) : null
  const previewQuery = useShuttleSchedule(undefined, previewDate, { enabled: previewing })
  // 미운행일이면 다음 평일 시간표를 폴백으로 fetch.
  const offDay = isShuttleOffDay(direction)
  const weekdayDate = offDay ? nextWeekdayDateStr() : null
  const weekdayFallback = useShuttleSchedule(undefined, weekdayDate, { enabled: offDay })
  // 2캠 일요일 한정: 토요일 시간표도 함께 fetch — 배너 셀렉터에서 선택 가능.
  const saturdayDate = offDay && isSecondCampus ? lastSaturdayDateStr() : null
  const saturdayFallback = useShuttleSchedule(undefined, saturdayDate, { enabled: offDay && isSecondCampus })

  // 사용자 선택. null이면 데이터 가용성에 따라 자동 선택(아래 effectiveKind).
  const [fallbackKind, setFallbackKind] = useState(null)

  // 요청한 direction에 시간 데이터가 있는지로 todayEmpty 판정.
  // (백엔드 응답의 directions 배열에는 다른 방향 데이터가 있을 수 있어서
  //  단순 length 체크로는 본캠 0번이 비었는데도 2캠 2번 데이터 때문에 폴백이 안 켜졌음.)
  const findDirTimes = (apiData) => apiData?.directions?.find((d) => d.direction === direction)?.times ?? []
  const todayEmpty = !today.loading && (today.error || findDirTimes(today.data).length === 0)
  const weekdayHasData = findDirTimes(weekdayFallback.data).length > 0
  const saturdayHasData = isSecondCampus && findDirTimes(saturdayFallback.data).length > 0
  const anyFallback = weekdayHasData || saturdayHasData
  const usingFallback = offDay && todayEmpty && anyFallback

  // 사용자가 명시적으로 고르지 않았으면 데이터가 있는 쪽을 자동 선택(평일 우선).
  const effectiveKind = fallbackKind ?? (weekdayHasData ? 'weekday' : (saturdayHasData ? 'saturday' : 'weekday'))
  const useSaturday = isSecondCampus && effectiveKind === 'saturday'
  const fallback = useSaturday ? saturdayFallback : weekdayFallback

  // 미리보기가 켜져 있으면 폴백보다도 우선한다(사용자의 명시적 선택).
  const data = previewing ? previewQuery.data : (usingFallback ? fallback.data : today.data)
  // 폴백 fetch가 끝나기 전엔 EmptyMsg가 잠깐 깜빡일 수 있으므로,
  // 미운행일이면 폴백 loading도 함께 봐서 모두 끝나야 EmptyMsg를 보여준다.
  const loading = previewing
    ? previewQuery.loading
    : today.loading || (offDay && (weekdayFallback.loading || (isSecondCampus && saturdayFallback.loading)))
  const error = previewing
    ? previewQuery.error
    : today.error && (!offDay || (weekdayFallback.error && (!isSecondCampus || saturdayFallback.error)))
  // 어느 쿼리가 실패했는지에 따라 다시 시도할 쿼리도 갈린다 — 화면에 보이는
  // 데이터의 출처(today/폴백/미리보기)와 항상 같은 쿼리를 재호출해야 한다.
  const retryError = previewing
    ? previewQuery.refetch
    : () => {
        today.refetch?.()
        if (offDay) {
          weekdayFallback.refetch?.()
          if (isSecondCampus) saturdayFallback.refetch?.()
        }
      }

  const nextRef = useRef(null)
  const now = new Date()
  // 폴백/미리보기 모드: 시간표 전체를 보여주기 위해 모든 시각을 "미래"로 취급.
  const nowStr = usingFallback || previewing ? '00:00' : toHHMM(now)
  const dirData = data?.directions?.find((d) => d.direction === direction)
  const times = dirData?.times ?? []

  // 좁은 폰(< 360px) 전용 가로 스크롤 스트립 데이터 — ShuttleTimetable.jsx의
  // buildDisplayList를 그대로 재사용해 수시운행 밴드 묶기 로직을 중복하지 않는다.
  // (mistakes.md §2: 표시 로직은 한 곳의 헬퍼로) times는 문자열/객체가 섞여 있을 수
  // 있어 {depart_at, note} 형태로 정규화한 뒤 넘긴다.
  const normalizedTimes = times.map((t) => ({
    depart_at: (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5),
    note: typeof t === 'object' ? t?.note ?? null : null,
    variant: typeof t === 'object' ? t?.variant ?? null : null,
  }))
  const stripDisplayList = buildDisplayList(normalizedTimes)
  const stripNowMinutes = usingFallback || previewing ? 0 : now.getHours() * 60 + now.getMinutes()
  const stripNextIndex = stripDisplayList.findIndex((item) =>
    item.type === 'fixed' ? item.minutes > stripNowMinutes : item.endMin > stripNowMinutes
  )

  // 오늘 하루 전체(과거+다음+이후) 시(hour) 그룹/수시운행 블록/회차편 블록 —
  // 시안 "시간표 화면" 규격. 과거는 최근 2개만 자르던 예전 방식(future/past 분리)
  // 대신 하루 전체를 그려서 지난 시(hour) 그룹도 흐리게 보여준다.
  const shuttleGroups = buildShuttleGroups(annotateShuttleEntries(times, nowStr))
  const future = times.filter((t) => {
    const timeStr = (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5)
    return timeStr >= nowStr
  })

  useEffect(() => {
    scrollToCenter(scrollContainerRef?.current, nextRef.current)
  }, [data, scrollContainerRef])

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg onRetry={retryError} />
  // 폴백조차 없는(또는 선택과 무관하게 둘 다 비어있는) 진짜 empty 케이스만 여기서 차단.
  // usingFallback/미리보기 상태에서는 배너·기간 칩을 유지해 사용자가 되돌아갈 수 있게 한다.
  if (!times.length && !usingFallback && !previewing) {
    const offText = isSecondCampus
      ? '일요일·공휴일에는 2캠 셔틀이 운행하지 않고, 평일·토요일 시간표도 아직 준비되지 않았어요.'
      : '주말·공휴일에는 셔틀이 운행하지 않고, 평일 시간표도 아직 준비되지 않았어요.'
    return <EmptyMsg text={offDay ? offText : '오늘 셔틀 정보가 없어요'} />
  }

  const selectedEmpty = usingFallback && !previewing && times.length === 0
  const previewEmpty = previewing && times.length === 0
  const allDone = !selectedEmpty && !previewEmpty && future.length === 0

  const presentVariants = variantsInTimes(times)

  return (
  <>
    <div className="flex flex-col gap-2">
      {periods.length >= 2 && (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5 mb-1" role="group" aria-label="운행 기간 선택">
          {periods.map((p) => {
            const vKey = periodVariantKey(p)
            const meta = vKey ? PERIOD_VARIANTS[vKey] : null
            const isCurrent = p.id === currentPeriod?.id
            const isActive = previewing ? p.id === previewPeriod.id : isCurrent
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedPeriodId(isCurrent ? null : p.id)}
                className={`px-2.5 py-1.5 rounded-pill text-caption font-semibold pressable transition-colors border ${
                  isActive
                    ? `${meta ? meta.chipClass : 'bg-accent-bg text-accent-ink dark:text-accent-ink'} border-transparent ring-1 ring-accent dark:ring-accent`
                    : 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute border-line dark:border-line'
                }`}
              >
                {shortPeriodName(p.name)}
                <span className="ml-1 font-medium tabular-nums">{periodRangeLabel(p)}</span>
                {isCurrent && <span className="font-bold"> · 지금</span>}
              </button>
            )
          })}
        </div>
      )}
      {previewing && (
        <div className="mb-1 px-3.5 py-2.5 rounded-card bg-accent-bg dark:bg-accent-bg flex items-center gap-2">
          <span className="text-caption font-bold text-accent-ink dark:text-accent-ink flex-1 min-w-0">
            미리보기 · {previewPeriod.name} ({periodRangeLabel(previewPeriod)}) 평일 시간표
          </span>
          <button
            type="button"
            onClick={() => setSelectedPeriodId(null)}
            className="flex-shrink-0 px-2.5 py-1 rounded-pill bg-accent dark:bg-accent text-white dark:text-ink text-caption font-bold pressable"
          >
            오늘로
          </button>
        </div>
      )}
      {usingFallback && !previewing && (
        <div
          className="-mx-4 mb-2 px-5 py-3.5 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, #fef6e6 0%, #fdebcb 100%)',
            borderLeft: '4px solid #d4a14a',
          }}
        >
          <span className="text-eta-sm font-normal leading-none mt-0.5 flex-shrink-0">⚠</span>
          <div className="flex-1 min-w-0 dark:text-[#d4a14a]" style={{ color: '#a07517' }}>
            <div className="text-label font-semibold tracking-tight leading-tight">
              {isSecondCampus
                ? '일요일·공휴일엔 2캠 셔틀버스가 운행하지 않습니다'
                : '주말·공휴일엔 셔틀버스가 운행하지 않습니다'}
            </div>
            <div className="text-meta font-semibold mt-1 opacity-90">
              아래는 <span className="font-semibold">{useSaturday ? '토요일' : '평일'} 기준 시간표</span>입니다.
            </div>
          </div>
          {isSecondCampus && (
            <div
              role="group"
              aria-label="폴백 시간표 종류 선택"
              className="flex-shrink-0 self-center flex rounded-full overflow-hidden"
              style={{ border: '1.5px solid #d4a14a' }}
            >
              <button
                type="button"
                onClick={() => setFallbackKind('weekday')}
                aria-pressed={!useSaturday}
                className="px-2.5 py-1 text-caption font-semibold tracking-tight transition-colors"
                style={{
                  background: !useSaturday ? '#d4a14a' : 'transparent',
                  color: !useSaturday ? '#fff' : '#a07517',
                }}
              >
                평일
              </button>
              <button
                type="button"
                onClick={() => setFallbackKind('saturday')}
                aria-pressed={useSaturday}
                className="px-2.5 py-1 text-caption font-semibold tracking-tight transition-colors"
                style={{
                  background: useSaturday ? '#d4a14a' : 'transparent',
                  color: useSaturday ? '#fff' : '#a07517',
                }}
              >
                토요일
              </button>
            </div>
          )}
        </div>
      )}
      {data?.schedule_name && !usingFallback && !previewing && (
        <p className="text-meta font-semibold text-mute dark:text-mute mb-1">
          {data.schedule_name} · 총 {times.length}회 · 남은 {future.length}회
        </p>
      )}
      {data?.schedule_name && (usingFallback || previewing) && !selectedEmpty && !previewEmpty && (
        <p className="text-meta font-semibold text-mute dark:text-mute mb-1">
          {data.schedule_name} · 총 {times.length}회
        </p>
      )}
      {presentVariants.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-1 mb-1">
          {presentVariants.map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-caption font-medium text-mute dark:text-mute">
              <span aria-hidden className={`w-2 h-2 rounded-full ${PERIOD_VARIANTS[k].dotClass}`} />
              {PERIOD_VARIANTS[k].label} 편
            </span>
          ))}
        </div>
      )}
      {SHUTTLE_BOARDING_INFO[direction] && (
        <p className="flex items-start gap-1.5 px-1 mb-1 text-caption font-medium text-mute dark:text-mute leading-snug">
          <MapPin size={13} aria-hidden className="mt-0.5 flex-shrink-0" />
          {SHUTTLE_BOARDING_INFO[direction]}
        </p>
      )}
      {previewEmpty ? (
        <p className="text-body font-semibold text-mute text-center py-6 px-4 leading-relaxed">
          이 기간의 평일 시간표가 비어 있어요.
        </p>
      ) : selectedEmpty ? (
        <p className="text-body font-semibold text-mute text-center py-6 px-4 leading-relaxed">
          선택한 <span className="font-semibold">{useSaturday ? '토요일' : '평일'}</span> 시간표가 비어 있어요.
          {isSecondCampus && (
            <><br />위 배너에서 <span className="font-semibold">{useSaturday ? '평일' : '토요일'}</span>을 눌러보세요.</>
          )}
        </p>
      ) : allDone ? (
        <>
          <div className="flex items-center gap-2 px-1 mb-1">
            <span className="text-meta font-semibold text-ink-2 dark:text-ink-2 bg-line dark:bg-line px-2.5 py-1 rounded-full">
              금일 운행 종료
            </span>
          </div>
          <TimeGrid times={times.map((t) => (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5))} />
        </>
      ) : isNarrowPhone ? (
        // 좁은 폰(< 360px) — 세로 리스트 대신 ShuttleTimetable.jsx의
        // NarrowPhoneStrip 패턴을 그대로 재사용(가로 스크롤 스냅 + 종 버튼).
        // 회차편/수시운행 부제 같은 상세 라벨은 이 스트립에서는 생략되고
        // buildDisplayList 표준 라벨("회차편", "수시운행")만 붙는다 — 화면이
        // 좁아 부제까지 넣으면 다시 잘리는 문제(F4-2)로 되돌아가므로 최소만 표시.
        <NarrowPhoneStrip
          displayList={stripDisplayList}
          nextIndex={previewing ? -1 : stripNextIndex}
          nowMinutes={stripNowMinutes}
          isAlarmSet={(time) => isAlarmSet(time, direction)}
          onOpenSheet={openSheet}
          embedded
          showBell={SHUTTLE_ALARM_ENABLED && !previewing}
        />
      ) : (
        // 시안 "시간표 화면" — 시(hour) 그룹 + 수시운행/회차편 블록 + "지금" 앵커.
        // 폴백(주말→평일)·미리보기에선 오늘 기준 카운트다운이 어긋나므로 앵커를 숨긴다.
        <ShuttleTimetableGroups
          groups={shuttleGroups}
          now={now}
          showAnchor={!previewing && !usingFallback}
          isOutbound={direction % 2 === 0}
          nextRef={nextRef}
        />
      )}
      {!isNarrowPhone && !previewEmpty && !selectedEmpty && (direction === 0 || direction === 1) && (
        <div className="mt-3 px-3.5 py-2.5 rounded-tile bg-surface-2 dark:bg-bg">
          <p className="text-meta font-semibold text-mute dark:text-mute leading-relaxed">
            정왕역~본교 약 10분 · 퇴근시간대 20~30분
          </p>
        </div>
      )}
    </div>
  {SHUTTLE_ALARM_ENABLED && (
    <ShuttleNotifySheet
      open={sheetTime != null}
      time={sheetTime ?? ''}
      directionLabel={DIRECTION_LABELS[direction] ?? null}
      onClose={closeSheet}
      onConfirm={handleConfirm}
    />
  )}
</>
)
}


// ─── shared UI ──────────────────────────────────────────────────────────

function LoadingList() {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width="100%" height="3rem" rounded="rounded-card" />
      ))}
    </div>
  )
}

// 에러는 다시 시도 버튼이 있어야 로딩·빈 상태와 구분된다 — ui/ErrorState로
// 통일한다(예전엔 그냥 빨간 텍스트 한 줄이라 재시도 수단이 없었다).
function ErrorMsg({ onRetry }) {
  return (
    <ErrorState message="정보를 불러오지 못했어요" onRetry={onRetry} className="py-4" />
  )
}

function EmptyMsg({ text }) {
  return <p className="text-body text-mute text-center py-4">{text}</p>
}

// ─── realtime bus history ────────────────────────────────────────────────

function BusHistoryContent({ routeNumber, category, trackedStopId: scopedTrackedStopId = null, stationLabel = null, scrollContainerRef }) {
  // 카드(SchedulePage → useBusArrivals)가 보는 GBIS 추적 정류장과 동일한 stop을
  // backend에도 명시해 realtime_eta 응답이 카드와 같은 정류장 기준이 되게 한다.
  // 시흥33처럼 양방향 실시간 추적이 있는 노선은 카테고리에 따라 stop이 갈린다.
  const trackedStopId = scopedTrackedStopId ?? getGbisStationIdForRoute(routeNumber, category)
  const { data, loading, error, refetch } = useBusHistoryPreview(routeNumber, trackedStopId)
  const routeId = data?.route_id
  const stopId = data?.stop_id
  const { data: statsRes } = useBusArrivalStats(routeId, stopId)
  const stats = statsRes?.stats ?? null
  const dayLabel = statsRes ? ({
    weekday: '평일', saturday: '토요일', sunday: '일/공휴일',
  }[statsRes.day_type] ?? null) : null
  const hourLabel = statsRes?.hour_of_day != null ? `${statsRes.hour_of_day}시` : null
  const anchorRef = useRef(null)

  const now = new Date()
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  useEffect(() => {
    scrollToCenter(scrollContainerRef?.current, anchorRef.current)
  }, [data, scrollContainerRef])

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg onRetry={refetch} />

  const columns = data?.columns ?? []
  if (columns.length === 0) {
    return <EmptyMsg text="아직 쌓인 이력 데이터가 없어요" />
  }

  const stopName = stationLabel || data?.stop_name

  const MAX_PAST = 4

  // 컬럼별 "지금 이후 첫 번째" 인덱스 + 이전 버스 MAX_PAST개만 남기도록 슬라이스
  const colViews = columns.map((col) => {
    const nextIdx = col.times.findIndex((t) => t >= nowStr)
    const sliceStart = nextIdx === -1
      ? Math.max(0, col.times.length - MAX_PAST)
      : Math.max(0, nextIdx - MAX_PAST)
    return {
      ...col,
      times: col.times.slice(sliceStart),
      nextIdx: nextIdx === -1 ? -1 : nextIdx - sliceStart,
      totalCount: col.times.length,
    }
  })

  // 스크롤 앵커: 가장 최근 컬럼의 next 위치
  const anchorColIdx = colViews.length - 1
  const anchorNextIdx = colViews[anchorColIdx].nextIdx

  return (
    <div>
      <BusEtaCard realtimeEta={data?.realtime_eta} predictedEta={data?.predicted_eta} />
      <BusStatsHeader stats={stats} dayLabel={dayLabel} hourLabel={hourLabel} />
      <p className="text-caption text-mute dark:text-mute mb-3 leading-relaxed">
        실시간 GBIS 기반{stopName ? ` · ${stopName}` : ''}
        <br />과거 실제 도착 기록을 날짜별로 표시합니다
      </p>

      {/* 독립 컬럼: 각 날짜가 자체 시간 순으로 쌓임. 행 정렬 없음. */}
      <div className="flex gap-1 -mx-1 px-1">
        {colViews.map((col, ci) => (
          <div key={ci} className="flex-1 min-w-0">
            {/* 헤더 */}
            <div className="text-center py-2 border-b border-line dark:border-line mb-0.5">
              <span className="block text-caption font-bold text-ink-2 dark:text-ink-2-dark whitespace-nowrap">
                {col.label}
              </span>
              <span className="block text-caption text-mute dark:text-mute whitespace-nowrap">
                {col.day_label}
              </span>
              {col.totalCount === 0 ? (
                <span className="block text-caption text-mute dark:text-mute mt-0.5">데이터 없음</span>
              ) : (
                <span className="block text-caption text-mute dark:text-mute mt-0.5">총 {col.totalCount}회</span>
              )}
            </div>

            {/* 시간 리스트 */}
            {col.totalCount === 0 ? (
              <p className="py-6 text-center text-caption text-mute dark:text-mute">데이터가 없습니다</p>
            ) : (
              col.times.map((t, i) => {
                const isNext = i === col.nextIdx
                const isPast = col.nextIdx !== -1 ? i < col.nextIdx : false
                const isAnchor = ci === anchorColIdx && i === Math.max(0, anchorNextIdx - 1)
                return (
                  <div
                    key={`${t}-${i}`}
                    ref={isAnchor ? anchorRef : undefined}
                    className={`py-0.5 text-center tabular-nums text-sm rounded-mini
                      ${isNext
                        ? 'font-semibold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : isPast
                          ? 'text-mute dark:text-mute'
                          : 'font-semibold text-ink dark:text-ink'
                      }`}
                  >
                    {t}
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── modal shell ────────────────────────────────────────────────────────

const TYPE_LABEL = { bus: '버스', subway: '지하철', shuttle: '셔틀' }
const TYPE_COLOR = { bus: '#3B82F6', subway: '#F5A623', shuttle: '#1b3a6e' }

function BusContextDetail({ context, routeCode, routeId, category, viewMode, scrollContainerRef }) {
  if (!context?.sources?.length) {
    return <BusContent routeCode={routeCode} routeId={routeId} category={category} viewMode={viewMode} scrollContainerRef={scrollContainerRef} />
  }

  // 여정 요약의 두 줄이 같은 내용이면 한 줄만 남긴다. origin → destination 이
  // journey_labels 의 양 끝과 겹치는 경우가 많아 같은 문장을 두 번 읽게 했다.
  const journey = (context.journey_labels ?? []).filter(Boolean)
  const headline = `${context.origin_label} → ${context.destination_label}`
  const journeyLine = journey.join(' → ')
  const showJourney = journey.length > 2 && journeyLine !== headline

  return (
    <div className="flex flex-col">
      <div className="pb-4">
        <p className="text-sm font-extrabold text-ink dark:text-ink">{headline}</p>
        {showJourney && (
          <p className="mt-1 text-xs font-medium text-mute">{journeyLine}</p>
        )}
      </div>
      {/* source 블록은 테두리 대신 구분선과 여백으로 나눈다. 지하철 상세와 같은 규칙이며,
          시트 폭을 그대로 써서 시간표 그리드가 좁아지지 않는다.
          검증: components/schedule/schedule.token.test.jsx */}
      {context.sources.map((source) => (
        <section
          key={source.id}
          aria-label={`${source.display_label} ${source.type === 'timetable' ? '시간표' : '실시간'}`}
          className="border-t border-line dark:border-line pt-4 pb-1"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <h3 className="text-sm font-extrabold text-ink dark:text-ink">{source.display_label}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-pill ${source.type === 'timetable' ? 'bg-surface-3 text-mute' : 'bg-accent/10 text-accent-ink dark:text-accent'}`}>
              {source.type === 'timetable' ? '시간표' : '실시간'}
            </span>
          </div>
          {source.type === 'timetable' ? (
            <BusContent routeCode={routeCode} routeId={routeId} stopId={source.stop_id} category={category} viewMode={viewMode} scrollContainerRef={scrollContainerRef} />
          ) : (
            <BusHistoryContent routeNumber={routeCode} category={category} trackedStopId={source.stop_id} stationLabel={source.station_label} scrollContainerRef={scrollContainerRef} />
          )}
        </section>
      ))}
    </div>
  )
}

export default function ScheduleDetailModal({ open, onClose, type, routeCode, routeId = null, stopId = null, category = null, commuteGroup = null, commuteContext = null, direction, subwayKey, title, accentColor, isRealtime = false, isFavorite = false, onToggleFav = null, onShowMap = null, pcMode = 'overlay' }) {
  const isPC =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

  // "다음 차" 자동 센터링이 스크롤할 유일한 대상 — scrollToCenter는 이 컨테이너만
  // 스크롤하므로 시트/문서 레벨이 함께 밀려 헤더가 잘리는 일이 없다.
  const scrollContainerRef = useRef(null)

  // 그리드/리스트 뷰 토글 — 셔틀(수시운행·회차편 등 특수 라벨이 많아 그리드에 맞지 않음)과
  // 실시간 버스(BusHistoryContent, 시간표 자체가 없음)는 항상 리스트/이력 뷰로 고정.
  // F3: 뷰 선택을 zustand persist(scheduleViewMode)로 이관 — 모달을 다시 열어도,
  // 설정 화면의 "시간표 보기" 기본값을 바꿔도 유지된다.
  const scheduleViewMode = useAppStore((s) => s.scheduleViewMode)
  const setScheduleViewMode = useAppStore((s) => s.setScheduleViewMode)
  const [viewMode, setViewModeState] = useState(scheduleViewMode)
  const setViewMode = (mode) => {
    setViewModeState(mode)
    setScheduleViewMode(mode)
  }

  const groupDefinitions = type === 'bus' ? (BUS_COMMUTE_GROUPS[category] ?? []) : []
  const group0 = useBusCommuteContexts(category, groupDefinitions[0]?.id)
  const group1 = useBusCommuteContexts(category, groupDefinitions[1]?.id)
  const group2 = useBusCommuteContexts(category, groupDefinitions[2]?.id)
  const group3 = useBusCommuteContexts(category, groupDefinitions[3]?.id)
  const groupResults = [group0.data, group1.data, group2.data, group3.data]
  const contextByGroup = new Map()
  groupDefinitions.forEach((group, index) => {
    const match = (Array.isArray(groupResults[index]) ? groupResults[index] : [])
      .find((context) => context.route_number === routeCode)
    if (match) contextByGroup.set(group.id, match)
  })
  if (commuteContext?.group_key && commuteContext.route_number === routeCode) {
    contextByGroup.set(commuteContext.group_key, commuteContext)
  }
  const commuteOptions = groupDefinitions.filter((group) => contextByGroup.has(group.id))
  const defaultCommuteGroup = commuteOptions.some((group) => group.id === commuteGroup)
    ? commuteGroup
    : commuteOptions[0]?.id ?? null
  const [activeCommuteGroup, setActiveCommuteGroup] = useState(defaultCommuteGroup)
  const [seenCommuteKey, setSeenCommuteKey] = useState(`${routeCode}:${category}:${commuteGroup}`)
  const commuteKey = `${routeCode}:${category}:${commuteGroup}`
  if (commuteKey !== seenCommuteKey) {
    setSeenCommuteKey(commuteKey)
    setActiveCommuteGroup(defaultCommuteGroup)
  }
  const activeContext = contextByGroup.get(activeCommuteGroup) ?? commuteContext
  const activeStopId = activeContext?.sources?.[0]?.stop_id ?? stopId
  const hasTimetableSource = activeContext?.sources?.some((source) => source.type === 'timetable') ?? !isRealtime
  const supportsGridToggle = (type === 'bus' && hasTimetableSource) || type === 'subway'

  // 이 컴포넌트는 GlobalDetailModal 등에서 앱 생명주기 내내 마운트된 채 `open`만
  // 토글되는 경우가 있어(unmount/remount 아님), 설정 화면에서 기본값을 바꾼 뒤에도
  // "다음에 열 때" 반영되도록 열릴 때마다 store 값으로 다시 동기화한다.
  const [seenOpen, setSeenOpen] = useState(open)
  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) setViewModeState(scheduleViewMode)
  }

  // 셔틀 방향은 시트 안에서 바꿀 수 있다(등교↔하교). 예전엔 카드가 넘긴 방향으로
  // 고정돼서, 하교를 보려면 시트를 닫고 다른 카드를 다시 열어야 했다.
  // 다른 카드로 진입하면(prop 변경) 그 방향으로 되돌린다 — 렌더 중 조정(effect 금지).
  const [shuttleDirection, setShuttleDirection] = useState(direction)
  const [seenDirection, setSeenDirection] = useState(direction)
  if (direction !== seenDirection) {
    setSeenDirection(direction)
    setShuttleDirection(direction)
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // PC는 백드롭/포커스트랩이 없는 non-modal 패널이라 자체 Escape 핸들러가 필요
  // (모바일은 Sheet가 Escape를 자동 처리).
  useEffect(() => {
    if (!isPC || !open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPC, open, onClose])

  // PC는 이전에도 애니메이션 없이 즉시 마운트/언마운트했으므로 동일하게 유지.
  if (isPC && !open) return null
  // 모바일도 이제 Sheet가 open=false일 때 스스로 null을 반환하므로 여기서 굳이
  // 일찍 리턴하지 않아도 된다 — title이 남아있는 한(직전 값 스냅샷) 계속 렌더해도
  // 무해하다. 아래로 내려가 header/body를 계산한 뒤 Sheet에 open만 넘긴다.
  if (!isPC && !open && !title) return null

  const fallbackColor = TYPE_COLOR[type] ?? '#64748B'
  // 헤더 점 색은 카드 배지와 같은 출처(ROUTE_DISPLAY_CONFIG)를 써야 한다.
  // 예전엔 호출부가 급행 4개 노선에만 accentColor를 넘겨서, 시흥33·20-1·11-A는
  // 카드에선 노선색인데 시트에선 타입 기본색(파랑)으로 떠 색이 어긋났다.
  const routeColor = type === 'bus' ? getRouteDisplayConfig(routeCode)?.color : null
  const color = accentColor ?? routeColor ?? fallbackColor
  const typeLabel = TYPE_LABEL[type] ?? ''
  // 마커 진입 등 title이 아직 없는 경로에서도 헤더가 빈 줄로 찌그러지지 않도록
  // routeCode → typeLabel 순으로 폴백한다(제목 잘림 버그와 함께 확인된 방어 로직).
  // 셔틀은 시트 안에서 방향을 바꿀 수 있다(아래 ShuttleContent의 세그먼트).
  // 방향이 바뀌면 헤더 제목도 따라가야 해서 여기서 직접 조립한다 — 넘겨받은 title은
  // 열 때의 방향으로 고정돼 있어 전환 후엔 거짓말이 된다.
  const shuttleTitle =
    type === 'shuttle'
      ? `${shuttleDirection >= 2 ? '2캠 ' : ''}셔틀버스 ${shuttleDirection % 2 === 0 ? '등교' : '하교'}`
      : null
  const displayTitle = shuttleTitle || title || routeCode || typeLabel || '시간표'
  const detailTypeLabel = type === 'bus'
    ? (hasTimetableSource ? '버스 시간표' : '버스 실시간 정보')
    : `${typeLabel} 시간표`

  const header = (
    <div className="flex items-center gap-3 px-5 pt-3 md:pt-4 pb-3 flex-shrink-0 border-b border-line dark:border-line">
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-display text-ink dark:text-ink truncate" style={{ letterSpacing: '-0.03em' }}>
          {displayTitle}
        </p>
        <p className="text-caption text-mute" style={{ fontWeight: 600 }}>{detailTypeLabel}</p>
      </div>
      {onShowMap && (
        <button
          onClick={onShowMap}
          aria-label="지도에서 보기"
          title="지도에서 보기"
          className="pressable p-2 rounded-full hover:bg-surface-2 dark:hover:bg-surface transition-colors flex-shrink-0"
        >
          <MapPin size={18} className="text-ink-2 dark:text-mute" />
        </button>
      )}
      {onToggleFav && (
        <button
          onClick={onToggleFav}
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          className="pressable p-2 rounded-full hover:bg-surface-2 dark:hover:bg-surface transition-colors flex-shrink-0"
        >
          <Star
            size={18}
            fill={isFavorite ? 'var(--tj-accent)' : 'none'}
            className={isFavorite ? 'text-accent dark:text-accent' : 'text-mute dark:text-mute'}
          />
        </button>
      )}
      <IconButton label="닫기" onClick={onClose} className="text-ink-2 dark:text-mute">
        <X size={18} />
      </IconButton>
    </div>
  )

  const body = (
    <>
      {type === 'bus' && commuteOptions.length > 1 && (
        <div className="px-5 pt-3 flex-shrink-0">
          <SegmentedControl
            options={commuteOptions.map((group) => ({ value: group.id, label: group.label }))}
            value={activeCommuteGroup}
            onChange={setActiveCommuteGroup}
            ariaLabel={category === '하교' ? '상세 방면 선택' : '상세 출발지 선택'}
          />
        </div>
      )}
      {/* 셔틀 방향 전환 — 버스의 방면 셀렉터와 같은 자리에 둬서 위치를 학습하지
          않아도 된다. 시트를 닫았다 다시 열지 않고 등교↔하교를 오간다. */}
      {type === 'shuttle' && (
        <div className="px-5 pt-3 flex-shrink-0">
          <SegmentedControl
            options={
              shuttleDirection >= 2
                ? [{ value: 2, label: '등교' }, { value: 3, label: '하교' }]
                : [{ value: 0, label: '등교' }, { value: 1, label: '하교' }]
            }
            value={shuttleDirection}
            onChange={setShuttleDirection}
            ariaLabel="셔틀 방향 선택"
          />
        </div>
      )}
      <div className="px-5 pt-3 pb-1 flex-shrink-0 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <Clock size={12} className="text-mute flex-shrink-0" />
          <p className="text-caption text-mute truncate">
            오늘 기준 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </span>
        {supportsGridToggle && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
      </div>

      {/* scrollable content — bottom padding 확보해 FloatingDock 위로 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-2"
        style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
      >
        {type === 'bus' && ROUTE_WAYPOINTS[routeCode] && (
          <div className="-mx-4 mb-4 border-b border-line dark:border-line pb-2">
            <p className="text-caption font-semibold text-mute dark:text-mute px-4 mb-3 uppercase tracking-wide">경유 노선</p>
            <RouteProgressStrip routeNo={routeCode} stationId={activeStopId} hasArrival={false} />
          </div>
        )}
        {type === 'bus' && <BusContextDetail context={activeContext} routeCode={routeCode} routeId={routeId} category={category} viewMode={viewMode} scrollContainerRef={scrollContainerRef} />}
        {type === 'subway' && <SubwayContent accentColor={color} subwayKey={subwayKey} viewMode={viewMode} scrollContainerRef={scrollContainerRef} />}
        {type === 'shuttle' && (
          <ShuttleContent
            direction={shuttleDirection}
            onDirectionChange={setShuttleDirection}
            accentColor={color}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </div>
    </>
  )

  // ── PC · inline: SchedulePage 2열 레이아웃의 우측 컬럼을 그대로 채운다.
  // portal/fixed 없음 — 부모(SchedulePage)의 컨테이너가 위치·크기를 결정.
  if (isPC && pcMode === 'inline') {
    return (
      <div className="w-full h-full bg-surface dark:bg-surface flex flex-col animate-panel-swap">
        {header}
        {body}
      </div>
    )
  }

  // ── PC · overlay(기본): 좌측 패널 내 콘텐츠 교체형 크로스페이드 (기존 UX, vaul 미적용) ──
  // GlobalDetailModal 전용 — 맵 홈(PCMainShell 38%/62% split)에서만 트리거되므로
  // 고정 폭 38% 가정이 유효하다.
  if (isPC) {
    return createPortal(
      <div
        className="fixed inset-0 z-sheet left-0 right-auto w-[38%] bottom-[68px] flex items-stretch justify-stretch pointer-events-none"
        aria-modal="true"
        role="dialog"
        aria-label={`${displayTitle} ${detailTypeLabel}`}
      >
        <div
          className="relative z-10 w-full bg-surface dark:bg-surface flex flex-col pointer-events-auto h-full animate-panel-swap"
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          {body}
        </div>
      </div>,
      document.body
    )
  }

  // ── 모바일: Sheet ── 백드롭·Escape·포커스 트랩을 Sheet에 맡긴다. 예전엔 이
  // 모달도 Sheet.jsx 머리말이 말하는 "아홉 벌 독립 구현" 중 하나였다(vaul 기반
  // 스와이프 다운 닫기). Sheet로 옮기며 스와이프 제스처는 없어지고, 다른 시트들과
  // 동일하게 배경 탭/Escape로 닫는다.
  return (
    <Sheet open={open} onClose={onClose} label={`${displayTitle} ${detailTypeLabel}`} placement="bottom">
      {header}
      {body}
    </Sheet>
  )
}
