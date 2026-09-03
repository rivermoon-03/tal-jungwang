import { useState, useMemo, useRef } from 'react'
import { Star, ChevronLeft } from 'lucide-react'
import { useBusTimetableByRoute, useBusHistoryPreview, useBusRoutes } from '../hooks/useBus'
import useAppStore from '../stores/useAppStore'
import { makeFavKey } from '../utils/favKey'
import RouteBadge from '../components/ui/RouteBadge'
import IconButton from '../components/ui/IconButton'
import SegmentedControl from '../components/ui/SegmentedControl'
import EmptyState from '../components/ui/EmptyState'
import ArrivalEtaCard from '../components/bus/ArrivalEtaCard'
import TimetableSection from '../components/bus/TimetableSection'
import StopsSection from '../components/bus/StopsSection'
import RouteCrowdingSummary from '../components/bus/RouteCrowdingSummary'
import ArrivalHistory from '../components/bus/ArrivalHistory'
import LastBusBanner from '../components/bus/LastBusBanner'
import { toHistoryRows } from '../utils/historyAdapter'
import { getGbisStationId, getGbisStationIdForRoute } from '../components/dashboard/busStationConfig'

// ──────────────────────────────────────────────────────────────────
// 리디자인(결함 #4/#19/#21/#22/#30): 통학생이 실제로 궁금한 순서로 섹션을
// 재배치한다 — ①도착 ②시간표(신설) ③정류장(신설) ④혼잡도(요약화) ⑤도착 기록(개선).
// 예전에는 "장소 중심 탭(도착/출발)"과 "showHistory 전체 화면 전환"으로 콘텐츠를
// 서로 감추는 구조였다. 이 페이지는 이제 위 5개 섹션을 하나의 스크롤에 순서대로
// 렌더한다 — 탭을 눌러야만 보이던 시간표/기록이 항상 스크롤해서 도달 가능하다.
// ──────────────────────────────────────────────────────────────────

// 헬퍼: "HH:MM" 문자열을 오늘 기준 총 분으로 변환
function timeToMinutes(timeStr) {
  const [hh, mm] = (timeStr ?? '').split(':').map(Number)
  if (isNaN(hh) || isNaN(mm)) return Infinity
  return hh * 60 + mm
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

// sunday 라벨은 '일/공휴일' — 실제 DB 조회 결과 모든 노선에서 saturday/sunday
// 시간표가 시각까지 완전히 동일하고(app/core/calendar.py가 공휴일도 'sunday'로
// 매핑), 이 탭이 실질적으로 "주말/공휴일 시간표"를 의미하기 때문.
const DAY_TABS = [
  { id: 'weekday',  label: '평일' },
  { id: 'saturday', label: '토요일' },
  { id: 'sunday',   label: '일/공휴일' },
]

// 오늘 요일로 기본 탭 결정 (0=일,1=월..6=토)
function defaultDayTab() {
  const dow = new Date().getDay()
  if (dow === 0) return 'sunday'
  if (dow === 6) return 'saturday'
  return 'weekday'
}

// ──────────────────────────────────────────────────────────────────
// API 응답 어댑터
// 백엔드는 { times: ["HH:MM", ...], schedule_type, notes } 형태로 응답.
// RouteDetailPage는 { timetable: { weekday: [{depart_at, note, is_last}] } } 구조를 기대.
// times 배열 형태일 때 현재 요청한 schedule_type 키로 변환해 반환.
// ──────────────────────────────────────────────────────────────────
function adaptTimetableResponse(raw) {
  if (!raw) return raw
  // 이미 timetable 객체 형태면 그대로 반환
  if (raw.timetable && typeof raw.timetable === 'object') return raw
  // times 배열 형태 → timetable 구조로 변환
  if (Array.isArray(raw.times)) {
    const dayKey = raw.schedule_type ?? 'weekday'
    const rows = raw.times.map((t, i) => ({
      depart_at: t,
      note: raw.notes?.[i] ?? null,
      is_last: false,
    }))
    // 마지막 행을 막차로 표시
    if (rows.length > 0) rows[rows.length - 1].is_last = true
    const timetable = { weekday: [], saturday: [], sunday: [] }
    timetable[dayKey] = rows
    return {
      ...raw,
      route_no: raw.route_name ?? raw.route_no,
      stops: raw.stops ?? [],
      timetable,
      first_bus: rows[0]?.depart_at ?? null,
      last_bus: rows[rows.length - 1]?.depart_at ?? null,
      total_trips: rows.length > 0 ? rows.length : null,
    }
  }
  return raw
}

const CATEGORY_LABELS = {
  '등교': '등교',
  '하교': '하교',
}

// ──────────────────────────────────────────────────────────────────
// 메인 RouteDetailPage 컴포넌트
// stop: busStationConfig 키 (예: '시흥시청', '서울'). 없으면 기존 동작.
//   - gbisStationId 있는 stop: 도착 정보 그룹만 표시
//   - gbisStationId null인 stop: 출발 시간표 그룹만 표시
//   - stop 없음: 두 그룹 모두 표시 (기존)
// ──────────────────────────────────────────────────────────────────
export default function RouteDetailPage({ routeNumber, initialCategory, stop = null }) {
  // stop prop에 따른 표시 분기 계산
  const stopGbisId = stop ? getGbisStationId(stop) : undefined
  const showArrivalGroup = stop === null || stop === undefined
    ? true                        // stop 없음: 기존 동작 (도착 카드 항상 표시)
    : stopGbisId != null          // GBIS 정류장이면 도착 정보 표시
  const [dayTab, setDayTab] = useState(defaultDayTab)

  // 전체 routes 목록에서 해당 routeNumber의 방향 목록 파악
  const { data: allRoutesData } = useBusRoutes()
  const availableCategories = useMemo(() => {
    if (!allRoutesData) return []
    const matched = (Array.isArray(allRoutesData) ? allRoutesData : allRoutesData?.routes ?? [])
      .filter((r) => r.route_number === routeNumber && r.category)
      .map((r) => r.category)
    const unique = [...new Set(matched)]
    unique.sort((a, b) => {
      const order = ['등교', '하교']
      return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
    })
    return unique
  }, [allRoutesData, routeNumber])

  // 방향 탭 기본값: initialCategory → 실시간 방향 우선 → 첫 번째
  const defaultCategory = useMemo(() => {
    if (initialCategory && availableCategories.includes(initialCategory)) return initialCategory
    if (availableCategories.length === 0) return null
    const realtimeCat = (Array.isArray(allRoutesData) ? allRoutesData : allRoutesData?.routes ?? [])
      .find((r) => r.route_number === routeNumber && r.is_realtime && r.category)
    if (realtimeCat && availableCategories.includes(realtimeCat.category)) return realtimeCat.category
    return availableCategories[0]
  }, [initialCategory, availableCategories, allRoutesData, routeNumber])

  const [activeCategory, setActiveCategory] = useState(null)

  // defaultCategory가 처음 확정되는 시점(null → 값)에 activeCategory를 세팅.
  // 렌더 중 조정 — 첫 확정값으로 고정한다(이후 defaultCategory가 바뀌어도 유지).
  if (activeCategory === null && defaultCategory !== null) {
    setActiveCategory(defaultCategory)
  }

  const resolvedCategory = activeCategory ?? defaultCategory

  // 노선 번호로 시간표 조회 — 요일 전환 + category 파라미터 전달
  const { data: ttRaw, loading: ttLoading, error: ttError } = useBusTimetableByRoute(routeNumber, {
    scheduleType: dayTab,
    category: resolvedCategory ?? undefined,
  })
  const ttData = useMemo(() => adaptTimetableResponse(ttRaw), [ttRaw])

  // is_realtime 플래그 (시간표 응답에서 직접 읽기).
  // 노선의 gbis_route_id 존재 여부가 아니라 이 방면(routeNumber+category)에
  // 실제 실시간 정보 source가 있는지를 백엔드가 판정해 내려준다 — 3400·6502처럼
  // 같은 gbis_route_id를 등교/하교가 공유해도 방면별로 다를 수 있다(2026-09).
  const isRealtime = ttData?.is_realtime ?? false


  // 이전 도착 기록 (history-preview) — 실시간 노선에서만 의미 있음.
  // 카드와 동일하게 방향별 GBIS 추적 정류장을 넘겨, 선택한 방향(등교/하교)의 실시간 도착을 본다.
  const histStopId = getGbisStationIdForRoute(routeNumber, resolvedCategory ?? undefined)
  const { data: histData, loading: histLoading } = useBusHistoryPreview(routeNumber, histStopId)

  const nowMin = useMemo(() => nowMinutes(), [])

  // 즐겨찾기 — favKey 스키마(utils/favKey.js) + 스토어 keys 배열.
  const routeIdForFav = ttData?.route_id ?? histData?.route_id ?? routeNumber
  const favKey = routeIdForFav
    ? makeFavKey({ mode: 'bus', id: routeIdForFav, direction: resolvedCategory })
    : null
  const favoriteKeys = useAppStore((s) => s.favorites.keys ?? [])
  const toggleFavoriteKey = useAppStore((s) => s.toggleFavoriteKey)
  const isFavorite = Boolean(favKey) && favoriteKeys.includes(favKey)

  // 정류장 목록 (③ 정류장 섹션용)
  const stops = ttData?.stops ?? []

  // "오늘" 실제 요일 기준 시간표 — 막차 배너/ETA 카드의 다음 출발 보강은 사용자가
  // 요일 탭을 바꿔 미리보기 중이어도 실제 "오늘" 기준으로만 판단해야 한다.
  const todaySchedule = useMemo(() => {
    if (!ttData?.timetable) return []
    return ttData.timetable[defaultDayTab()] ?? []
  }, [ttData])

  const todayDayLabel = DAY_TABS.find((t) => t.id === defaultDayTab())?.label ?? null

  // 오늘 시간표 기준 다음 출발 — ETA 카드가 실시간 정보 없을 때 보강용으로 쓴다.
  const nextScheduledToday = useMemo(() => {
    return todaySchedule.find((e) => timeToMinutes(e.depart_at) >= nowMin) ?? null
  }, [todaySchedule, nowMin])

  // 이 방향이 "어느 요일이든" 출발 시간표를 갖는지 — dayTab(현재 선택된 요일)과 무관하게
  // 판정한다. 시간표가 아예 없는 방향은 ② 섹션 자체를 숨긴다(빈 섹션 금지).
  const timetableHasAnyDay = useMemo(() => {
    const t = ttData?.timetable
    if (!t) return false
    return Object.values(t).some((arr) => Array.isArray(arr) && arr.length > 0)
  }, [ttData])

  const hasRealtimeGroup = isRealtime && showArrivalGroup
  // 시간표가 있으면 항상 보여준다.
  //
  // 예전에는 GBIS 정류장에서 실시간이 되면 시간표를 숨겼다. 도착 정보가 있으니
  // 중복이라는 판단이었는데 실제로는 정보가 사라졌다. 시화터미널의 3400 은
  // is_realtime 이 true 라 평일 43편을 다 갖고도 첫차도 막차도 배차도 안 나왔다.
  // 실시간은 "다음 차가 언제 오나" 를, 시간표는 "오늘 운행이 어떻게 짜여 있나" 를
  // 답해서 서로 대체하지 않는다. 빈 섹션은 timetableHasAnyDay 가 막는다.
  const hasTimetableCapability = timetableHasAnyDay

  // ① 도착 카드 표시 여부. stop prop 없이 열린 메인 페이지(standalone)에서는
  // is_realtime=false 노선이어도 ArrivalEtaCard의 "시간표 기준 다음 출발" 상태를
  // 그대로 보여준다(원본 스펙 — 노선 자체 정보가 우선). 반면 특정 GBIS 정류장을
  // 스코프로 받은 임베딩(stop prop 있음)에서 그 노선이 실시간 추적 대상이 아니면
  // ("이 정류장 도착 정보" 위젯인데 tracked 데이터가 없음) 도착 카드를 아예
  // 숨기고 시간표 섹션만 보여준다 — 예전 "그룹 A" 가시성 규칙과 동일하게 유지해
  // 시화터미널+3400 같은 조합에서 엉뚱한 기점 출발시각을 "도착 정보"인 것처럼
  // 보여주지 않는다.
  const showArrivalCard = showArrivalGroup && (hasRealtimeGroup || (stop === null || stop === undefined))

  // 이전 도착 기록 rows — histData 어댑터 변환 (is_realtime=true일 때만)
  const historyRows = useMemo(() => {
    if (!hasRealtimeGroup) return []
    return toHistoryRows(histData, new Date())
  }, [hasRealtimeGroup, histData])

  // 이전 도착 기록 헤더 라벨 (history-preview columns의 day_label 사용)
  const historyColumnLabels = useMemo(() => {
    const cols = histData?.columns
    if (!Array.isArray(cols) || cols.length === 0) return null
    return {
      // 백엔드가 같은 요일 3주치(지난주/2주 전/3주 전)를 주므로 label을 그대로 쓴다.
      // day_label(날짜)은 셀 title 툴팁 정보로 충분 — 헤더는 짧게.
      yesterday: cols[0]?.label ?? cols[0]?.day_label ?? '지난주',
      dayBefore: cols[1]?.label ?? cols[1]?.day_label ?? '2주 전',
      lastWeek: cols[2]?.label ?? cols[2]?.day_label ?? '3주 전',
    }
  }, [histData])

  // 노선 표시명 / 행선지 / 기점
  const routeDisplayName = ttData?.route_no ?? routeNumber ?? ''
  const headLabel = ttData?.direction_name ?? ttData?.head_label ?? ttData?.direction ?? null
  const subLabel = ttData?.path_label ?? null
  const originStopName = ttData?.origin_stop_name ?? null

  // ⑤ 도착 기록 섹션으로 스크롤 — ② 시간표 섹션 하단 "과거 도착 기록 보기" 링크가
  // 이 ref로 이동한다. 도착 기록 진입 링크는 페이지 전체에서 이 한 곳만 존재한다
  // (결함 #30 — 예전엔 "도착 기록 >" 화살표와 "평소 배차 간격 보기" 링크가 병렬 중복).
  const historyRef = useRef(null)
  function scrollToHistory() {
    historyRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  function handleBack() {
    window.history.back()
  }

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg">
      {/* ── 헤더 ── */}
      <header className="flex-none flex items-center gap-[11px] px-4 pt-[18px] pb-[13px] bg-surface dark:bg-surface border-b border-line dark:border-line">
        {/* 42px 커스텀 버튼 대신 44px 정본(IconButton). variant="floating"은
            표면을 보더가 아니라 shadow-sh-card로 띄운다(시안2 규율). */}
        <IconButton label="뒤로" onClick={handleBack} variant="floating">
          <ChevronLeft size={20} />
        </IconButton>

        <div className="flex-1 min-w-0 flex items-center gap-[9px]">
          <RouteBadge route={routeDisplayName} />
          <div className="min-w-0">
            {headLabel && (
              <span className="block text-body font-semibold text-ink dark:text-ink tracking-[-0.02em] truncate">
                {headLabel}
              </span>
            )}
            {stop ? (
              <span className="block text-caption font-semibold text-mute dark:text-mute mt-px truncate">
                {stop} 기준
              </span>
            ) : originStopName ? (
              <span className="block text-caption font-semibold text-mute dark:text-mute mt-px truncate">
                {originStopName} 출발
              </span>
            ) : subLabel ? (
              <span className="block text-caption font-semibold text-mute dark:text-mute mt-px">
                {subLabel}
              </span>
            ) : null}
          </div>
        </div>

        <IconButton
          label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          onClick={() => favKey && toggleFavoriteKey(favKey)}
          variant="floating"
        >
          <Star
            size={19}
            fill={isFavorite ? 'currentColor' : 'none'}
            className={isFavorite ? 'text-imminent' : 'text-mute dark:text-mute'}
          />
        </IconButton>
      </header>

      {/* ── 바디 ──
          PC에서 폭을 그대로 두면 요소 하나가 지나치게 넓어진다 — 최대 폭을
          제한하고 제목과 같은 좌측 기준선에 맞춘다. */}
      <div className="flex-1 overflow-hidden flex flex-col tj-page-w">
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-3 pb-28 md:pb-6 flex flex-col gap-6">
            {/* 막차 임박 배너 — 30분 이내일 때만 렌더(LastBusBanner 내부 판정) */}
            <LastBusBanner entries={todaySchedule} routeLabel={routeDisplayName} />

            {/* 방향 세그먼트(등교/하교) — 다크에서 teal로 변하던 커스텀 필 대신
                공용 SegmentedControl 사용(자동 해소). 두 방향 이상일 때만 노출. */}
            {availableCategories.length > 1 && (
              <SegmentedControl
                ariaLabel="방향 선택"
                options={availableCategories.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] ?? cat }))}
                value={resolvedCategory}
                onChange={(cat) => setActiveCategory(cat)}
              />
            )}

            {ttLoading && <EmptyState title="불러오는 중..." />}

            {ttError && !ttLoading && (
              <EmptyState title="시간표를 불러올 수 없어요" desc="잠시 후 다시 시도해 주세요" />
            )}

            {!ttLoading && !ttError && !hasRealtimeGroup && !hasTimetableCapability && (
              <EmptyState title="운행 정보 없음" desc="해당 요일 운행 정보가 없어요" />
            )}

            {!ttLoading && !ttError && (hasRealtimeGroup || hasTimetableCapability) && (
              <>
                {/* ① 도착 — ETA 2슬롯 고정, 상황별 정확한 한 문장(결함 #30) */}
                {showArrivalCard && (
                  <section aria-label="도착 정보">
                    <ArrivalEtaCard
                      histData={hasRealtimeGroup ? histData : null}
                      histLoading={hasRealtimeGroup ? histLoading : false}
                      nextScheduled={nextScheduledToday}
                    />
                  </section>
                )}

                {/* ② 시간표(신설) — 시간표가 있는 방향에서만 렌더(내부에서도 재검증).
                    key={resolvedCategory}: 등교/하교 전환은 리마운트 없는 같은
                    컴포넌트 인스턴스라 defaultExpanded는 최초 마운트에만 반영된다.
                    방향을 바꾸면 펼침 기본값도 그 방향 기준으로 다시 계산돼야
                    하므로 key로 강제 리마운트한다. */}
                {hasTimetableCapability && (
                  <TimetableSection
                    key={resolvedCategory}
                    timetable={ttData.timetable}
                    dayTab={dayTab}
                    onDayTabChange={setDayTab}
                    nowMin={nowMin}
                    originStopName={originStopName}
                    onJumpToHistory={hasRealtimeGroup ? scrollToHistory : null}
                    defaultExpanded={!hasRealtimeGroup}
                  />
                )}

                {/* ③ 정류장(신설) — 등록된 탑승 정류장 + 방면만 정직하게 표시.
                    activeStopName: 위 ① ETA 카드가 실시간 계산에 쓴 정류장(3401처럼
                    승차 정류장이 2곳인 노선에서 "어느 정류장 기준인지" 표시). */}
                <StopsSection
                  stops={stops}
                  directionName={headLabel}
                  activeStopName={hasRealtimeGroup ? histData?.stop_name : null}
                />

                {/* ④ 혼잡도(요약화) — 실시간 추적 노선에서만 의미 있는 데이터 */}
                {hasRealtimeGroup && <RouteCrowdingSummary routeNumber={routeNumber} />}

                {/* ⑤ 도착 기록(개선) — 실제 도착 이력 + 배차 간격 결론 문장 */}
                {hasRealtimeGroup && (
                  <section aria-label="과거 도착 기록" ref={historyRef}>
                    {histLoading ? (
                      <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-4 py-4 text-body font-semibold text-mute text-center">
                        기록 불러오는 중...
                      </div>
                    ) : (
                      <ArrivalHistory
                        rows={historyRows}
                        routeNumber={routeNumber}
                        columnLabels={historyColumnLabels}
                        columns={histData?.columns}
                        dayLabel={todayDayLabel}
                      />
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
