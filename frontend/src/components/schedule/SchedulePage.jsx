/**
 * SchedulePage — 시간표 탭
 * - 상단 mode pill: 버스 · 지하철 · 셔틀 (바로 전환)
 * - 각 모드별 그룹 pill selector (지하철: 정왕/초지/시흥시청, 버스: 하교/등교/기타)
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNow } from '../../hooks/useNow'
import ScheduleSection from './ScheduleSection'
import SubwayStationChips from './SubwayStationChips'
import ScheduleDetailModal from './ScheduleDetailModal'
import PageHeader from '../layout/PageHeader'
import SegmentedControl from '../ui/SegmentedControl'
import useAppStore from '../../stores/useAppStore'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { useBusTimetableByRoute, useBusArrivals, useBusRoutesByCategory, useBusCommuteContexts } from '../../hooks/useBus'
import { useShuttleSchedule, useShuttlePeriods } from '../../hooks/useShuttle'
import { pickCurrentPeriod } from '../shuttle/shuttlePeriods'
import { parseReturnNote } from '../shuttle/shuttleSchedule'
import { useSubwayNext, useSubwayTimetable } from '../../hooks/useSubway'
import { getRouteCategory, ROUTE_CATEGORY_ORDER } from '../dashboard/busStationConfig'
import { BUS_COMMUTE_GROUPS } from '../../utils/busCommuteContext'
import { describeArrival } from '../../utils/arrivalTime'
import { selectRepresentativeBusSource } from '../../utils/busInformationSource'
import { makeFavKey, matchesLegacy } from '../../utils/favKey'
import { BarChart3, CalendarClock, Star } from 'lucide-react'
import EmptyState from '../ui/EmptyState'
import IconButton from '../ui/IconButton'
import StatsSheet from './StatsSheet'
import HolidayBanner from '../common/HolidayBanner'
import { scaledPx } from '../../utils/fontScale'

// PC · 시간표 2열 레이아웃(좌: 노선 리스트 / 우: 상세)에서 아직 아무 노선도
// 선택하지 않았을 때 우측 컬럼에 보이는 빈 상태.
function ScheduleDetailEmptyState() {
  return (
    <EmptyState
      icon={<CalendarClock size={32} aria-hidden="true" />}
      title="노선을 선택해요"
      desc="왼쪽 목록에서 노선을 누르면 하루 전체 시간표와 혼잡도를 여기에서 볼 수 있어요."
    />
  )
}

// ─── url query helpers ─────────────────────────────────────────────────────
function readQuery() {
  if (typeof window === 'undefined') return { type: null, route: null, stop: null }
  const params = new URLSearchParams(window.location.search)
  return {
    type:  params.get('type'),
    route: params.get('route'),
    stop:  params.get('stop'),
  }
}

function navigateSchedule({ type = null, route = null, stop = null } = {}) {
  const params = new URLSearchParams()
  if (type)  params.set('type',  type)
  if (route) params.set('route', route)
  if (stop)  params.set('stop',  stop)
  const qs = params.toString()
  const url = qs ? `/schedule?${qs}` : '/schedule'
  window.history.replaceState({}, '', url)
}

// ─── static section definitions ────────────────────────────────────────────
const BUS_GROUP_IDS = [
  { id: '하교', label: '하교' },
  { id: '등교', label: '등교' },
  { id: '기타', label: '기타 노선' },
]

const SUBWAY_GROUPS = [
  { id: '정왕',     label: '정왕',     stationCode: 'K449' },
  { id: '초지',     label: '초지',     stationCode: 'K448' },
  { id: '시흥시청', label: '시흥시청', stationCode: 'K447' },
]

const SHUTTLE_CAMPUS_GROUPS = [
  { id: 'main',   label: '본캠' },
  { id: 'second', label: '2캠' },
]

const SHUTTLE_CAMPUS_DIRECTIONS = {
  main:   [{ id: '등교', label: '등교', direction: 0 }, { id: '하교', label: '하교', direction: 1 }],
  second: [{ id: '등교', label: '등교', direction: 2 }, { id: '하교', label: '하교', direction: 3 }],
}

// ─── mode label config ───────────────────────────────────────────────────────
// SegmentedControl(options: {value,label}[])이 정본 세그먼트 컨트롤이다 — 예전엔
// 이 파일이 모드 탭엔 ui/SegmentTabs를, 그룹 탭엔 ui/SegmentedControl을 동시에 써서
// 같은 화면 한 탭 간격으로 세그먼트 스타일이 두 벌 섞여 있었다.
const MODES = [
  { value: 'bus',     label: '버스'   },
  { value: 'subway',  label: '지하철' },
  { value: 'shuttle', label: '셔틀'   },
]

function isValidMode(v) {
  return v === 'bus' || v === 'subway' || v === 'shuttle'
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function timeStrToMinutes(timeStr, now) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  const diff = Math.round((d - now) / 60000)
  if (diff < 0 || diff > 12 * 60) return null
  return diff
}

// 노선/방향으로 다음 운행 요일을 대략 안내한다. 실제 seeded 데이터가 요일별 첫차를
// 언제나 보장하지 않아 구체 요일을 단정하지 않고, 주말이면 "월요일"만 알려준다
// (평일인데 시간표가 비어 있는 경우는 방학 등 데이터 공백일 수 있어 "평일"로만 표기).
// ─── per-route bus section ───────────────────────────────────────────────────
// 이전에는 components/bus/BusArrivalCard를 그대로 썼는데, 그 카드는 행 클릭 시
// 내부에서 직접 pushState 네비게이트를 실행해(자체 handleCardClick) PC
// master-detail 레이아웃이 우측 패널 대신 전체 페이지 이동으로 깨졌다(결함 #19/#33).
// 이 컴포넌트는 항상 onCardClick 콜백만 호출하고, 라우팅 여부는 상위(SchedulePage)의
// handleCardClick이 데스크톱/모바일로 분기해 결정한다.
function formatClock(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function useBusSourceState(source, routeCode, category) {
  const isTimetable = source?.type === 'timetable'
  const timetable = useBusTimetableByRoute(isTimetable ? routeCode : null, {
    stopId: source?.stop_id,
    category,
  })
  const arrivals = useBusArrivals(source && !isTimetable ? source.stop_id : null)
  const now = new Date(useNow(30_000))

  if (!source) return { value: null, snapshot: null }

  let value
  let snapshot
  if (isTimetable) {
    const next = (timetable.data?.times ?? []).find((time) => {
      const [hour, minute] = time.split(':').map(Number)
      const departure = new Date(now)
      departure.setHours(hour, minute, 0, 0)
      return departure > now
    })
    const minutesUntil = next ? timeStrToMinutes(next, now) : null
    value = next ? `다음 ${next}` : (timetable.data?.times?.length ? '금일 종료' : '운행일 확인')
    snapshot = {
      sourceId: source.id,
      type: source.type,
      loading: timetable.loading,
      minutesUntil,
      hhmm: next ?? null,
      imminent: false,
      timeLines: next ? null : (timetable.data?.times?.length ? ['금일', '종료'] : ['운행일', '확인']),
      // 시간열의 "금일 종료"는 56px 안 두 단어라 목록을 훑을 때 잘 안 읽힌다.
      // 본문 쪽 달 아이콘이 상태를 먼저 말하고, 첫차 시각이 다음 행동을 준다.
      sleeping: !next && Boolean(timetable.data?.times?.length),
      sleepingLabel: !next && timetable.data?.times?.length
        ? `다음 운행일 첫차 ${timetable.data.times[0]}`
        : null,
    }
  } else {
    const list = Array.isArray(arrivals.data) ? arrivals.data : arrivals.data?.arrivals ?? []
    const next = list
      .filter((arrival) => arrival.route_no === routeCode && arrival.arrival_type === 'realtime')
      .filter((arrival) => !arrival.travel_direction || arrival.travel_direction === source.travel_direction)
      .sort((a, b) => (a.arrive_in_seconds ?? Infinity) - (b.arrive_in_seconds ?? Infinity))[0]
    if (next?.arrive_in_seconds != null) {
      const described = describeArrival(next.arrive_in_seconds)
      value = described.imminent ? '곧 도착' : `${described.minutes}분 후`
      const arrivalAt = new Date(now.getTime() + next.arrive_in_seconds * 1000)
      snapshot = {
        sourceId: source.id,
        type: source.type,
        loading: arrivals.loading,
        minutesUntil: described.minutes,
        hhmm: formatClock(arrivalAt),
        imminent: described.imminent,
        timeLines: null,
      }
    } else {
      value = '도착 정보 확인 중'
      snapshot = {
        sourceId: source.id,
        type: source.type,
        loading: arrivals.loading,
        minutesUntil: null,
        hhmm: null,
        imminent: false,
        timeLines: arrivals.loading ? null : ['도착', '정보 없음'],
      }
    }
  }

  return { value, snapshot }
}

function BusSourceRow({ source, routeCode, category }) {
  const isTimetable = source.type === 'timetable'
  const { value } = useBusSourceState(source, routeCode, category)

  return (
    <div className="flex items-center gap-2 min-h-8 py-1">
      <span className="text-caption font-bold text-ink-2 dark:text-ink-2 min-w-0">{source.display_label}</span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isTimetable ? 'bg-surface-3 text-mute' : 'bg-accent/10 text-accent-ink dark:text-accent'}`}>
        {isTimetable ? '시간표' : '실시간'}
      </span>
      <span className="ml-auto text-xs font-semibold text-mute tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}

function BusRouteSection({ busGroup, commuteContext, favCode, onCardClick, onArrivalChange, isFavorite, onToggleFavorite, selected }) {
  const routeCode = commuteContext.route_number
  const journey = (commuteContext.journey_labels ?? []).filter(Boolean)
  const primarySource = commuteContext.sources?.[0] ?? null
  const realtimeSource = commuteContext.sources?.find((source) => source.type === 'realtime') ?? null
  const sources = useMemo(() => commuteContext.sources ?? [], [commuteContext.sources])
  const representativeSource = useMemo(() => selectRepresentativeBusSource(sources), [sources])
  const { snapshot: representativeSnapshot } = useBusSourceState(representativeSource, routeCode, busGroup)
  const fallbackTimetableSource = useMemo(() => {
    if (representativeSource?.type !== 'realtime') return null
    return sources.find((source) =>
      source.type === 'timetable' && source.stop_id === representativeSource.stop_id,
    ) ?? null
  }, [representativeSource, sources])
  const { snapshot: fallbackTimetableSnapshot } = useBusSourceState(fallbackTimetableSource, routeCode, busGroup)
  const useTimetableFallback = Boolean(
    fallbackTimetableSnapshot?.hhmm &&
    !representativeSnapshot?.loading &&
    representativeSnapshot?.minutesUntil == null &&
    !representativeSnapshot?.imminent
  )
  const displaySnapshot = useTimetableFallback ? fallbackTimetableSnapshot : representativeSnapshot

  // 도착순 정렬(시안 1-A) — 이 카드가 실제로 화면에 보여주는 도착 분(displaySnapshot과
  // 같은 값)을 부모(BusGroupContent)에 보고해 정렬 기준으로 쓴다. 정렬 기준을
  // 화면 표시값과 다른 지표(예전엔 sources 유무)로 따로 두면 "9분짜리가 맨
  // 아래" 같은 어긋남이 생긴다.
  useEffect(() => {
    onArrivalChange?.(favCode, displaySnapshot?.minutesUntil ?? null)
  }, [favCode, displaySnapshot?.minutesUntil, onArrivalChange])

  function handleClick() {
    onCardClick({
      type: 'bus',
      routeCode,
      routeId: commuteContext.route_id,
      stopId: primarySource?.stop_id ?? null,
      category: busGroup,
      commuteGroup: commuteContext.group_key,
      realtimeStationId: realtimeSource?.stop_id ?? null,
      commuteContext,
      favCode,
      isRealtime: Boolean(realtimeSource),
      title: `${routeCode} · ${commuteContext.destination_label} 방면`,
      accentColor: (['3400', '5200', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
    })
  }

  // 제목 한 줄 정리 — 하교 방면 탭이 있던 시절엔 제목이 "OO 방면"(목적지만)
  // 이어도 괜찮았다. 탭을 없앤 뒤(경유지 한 줄 표기로 대체)에는 제목이 여전히
  // "OO 방면"만 말하고, 아래 경유 줄이 "출발지 → ... → OO"로 같은 목적지를
  // 다시 말해 한 카드 안에서 두 번 겹쳤다. 상세 시트 헤드라인
  // (ScheduleDetailModal.BusContextDetail)과 같은 규칙으로 통일한다: 제목은
  // "출발지 → 목적지" 요약 한 줄, 경유지가 양 끝 말고도 더 있을 때만 아래
  // 줄에 전체 경로를 덧붙인다.
  const headline = `${commuteContext.origin_label} → ${commuteContext.destination_label}`
  const journeyLine = journey.join(' → ')
  const showJourney = journey.length > 2 && journeyLine !== headline

  // 한 줄 압축 — 승차 지점이 하나뿐이면 시간열 큰 숫자와 이 노선의 유일한
  // 출처가 같은 값이라, 아래 출처 줄("OO 승차 [실시간] N분 후")이 방금 읽은
  // 숫자를 문장으로 반복했다. 승차·통과 지점이 둘 이상(3401처럼 승차지와
  // 통과지가 갈릴 때)일 때만 지점별 줄을 남긴다 — 그때는 대표 시간열 하나로
  // 담을 수 없는 정보이고, 상세 시트에도 같은 지점별 목록이 있어 여기서
  // 지워도 정보 자체는 사라지지 않는다.
  const showSourceRows = sources.length > 1

  return (
    <div data-testid={`bus-context-${routeCode}`}>
      <ScheduleSection
        type="bus"
        routeCode={routeCode}
        title={headline}
        timeLines={displaySnapshot?.timeLines ?? null}
        sleeping={Boolean(displaySnapshot?.sleeping)}
        sleepingLabel={displaySnapshot?.sleepingLabel ?? null}
        minutesUntil={displaySnapshot?.minutesUntil ?? null}
        hhmm={displaySnapshot?.hhmm ?? null}
        imminent={displaySnapshot?.imminent ?? false}
        loading={Boolean(displaySnapshot?.loading)}
        liveChip={sources.some((source) => source.type === 'realtime')}
        timetableChip={sources.some((source) => source.type === 'timetable')}
        boldPrefix={showJourney ? journey[0] : null}
        subtitle={showJourney ? ` → ${journey.slice(1).join(' → ')}` : null}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onClick={handleClick}
        selected={selected}
        footer={showSourceRows && (
          <div className="divide-y divide-line dark:divide-line">
            {sources.map((source) => (
              <BusSourceRow key={source.id} source={source} routeCode={routeCode} category={busGroup} />
            ))}
          </div>
        )}
      />
    </div>
  )
}

// ─── subway direction config per station ─────────────────────────────────────
const SUBWAY_DIRECTIONS = {
  정왕: [
    { subtitle: '수인분당선', symbol: '수', upKey: 'up',       downKey: 'down',       upLabel: '상행', downLabel: '하행', color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
    { subtitle: '4호선',     symbol: '4',  upKey: 'line4_up', downKey: 'line4_down', upLabel: '상행', downLabel: '하행', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
  ],
  초지: [
    { subtitle: '서해선', symbol: '서', upKey: 'choji_up',   downKey: 'choji_dn',   upLabel: '상행', downLabel: '하행', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
  ],
  시흥시청: [
    { subtitle: '서해선', symbol: '서', upKey: 'siheung_up', downKey: 'siheung_dn', upLabel: '상행', downLabel: '하행', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
  ],
}

// 지하철 방향 키 → 실제 종착 방면(확인된 값만, 근거 없는 값은 비워 label로 폴백).
const SUBWAY_DEST_LABEL = {
  up: '왕십리 방면',
  down: '인천 방면',
  choji_up: '소사 방면',
  choji_dn: '원시 방면',
  siheung_up: '소사 방면',
  siheung_dn: '원시 방면',
}

// ─── subway section ──────────────────────────────────────────────────────────
function SubwaySection({ stationGroup, onCardClick, favoritesOnly = false, isFav, onToggleFav, selectedFavCode }) {
  // PC 2열 레이아웃에서는 버스/셔틀처럼 우측 인라인 패널(ScheduleDetailModal
  // pcMode="inline")에 떠야 한다. 모바일은 기존 zustand 전역 시트(GlobalSubwayDetailSheet,
  // 열차 위치 지도 등 subway 전용 UI)를 그대로 유지한다.
  const isDesktop = useIsDesktop()
  const { data, loading } = useSubwayNext()
  const { data: timetable } = useSubwayTimetable()
  const setSubwayDetailSheet = useAppStore((s) => s.setSubwayDetailSheet)
  const directions = useMemo(() => SUBWAY_DIRECTIONS[stationGroup] ?? [], [stationGroup])
  // 1초 tick(분 단위 카운트다운 갱신용). 시간표 파생 계산은 분 단위로만 재계산한다.
  const nowMs = useNow(1000)
  const now = new Date(nowMs)
  // 분 단위로 절삭한 현재 시각(Asia/Seoul = 배포 로컬). 초가 바뀌어도 동일하므로
  // 아래 timetable 파생 useMemo가 매초 재계산되지 않게 하는 의존성 키로 쓴다.
  const nowMinute = Math.floor(nowMs / 60000)

  // 각 방향 key별 "둘째 출발 시각"(다음다음 열차). timetable과 분 단위 현재시각이
  // 바뀔 때만 재계산. 초 단위 tick으로는 .map().filter().sort()를 돌리지 않는다.
  const secondDepartMap = useMemo(() => {
    const out = {}
    // nowMinute를 분 경계의 Date로 재구성(초/밀리초 = 0). 사전순 비교 금지 — Date로 비교.
    const minuteNow = new Date(nowMinute * 60000)
    const keys = new Set()
    for (const dir of directions) {
      keys.add(dir.upKey)
      keys.add(dir.downKey)
    }
    for (const key of keys) {
      const list = timetable?.[key]
      if (!Array.isArray(list) || list.length === 0) {
        out[key] = null
        continue
      }
      const future = list
        .map((e) => {
          const ts = (e?.depart_at ?? '').slice(0, 5)
          if (!ts) return null
          const [h, m] = ts.split(':').map(Number)
          if (Number.isNaN(h) || Number.isNaN(m)) return null
          const d = new Date(minuteNow)
          d.setHours(h, m, 0, 0)
          if (d <= minuteNow) return null
          return { ts, d }
        })
        .filter(Boolean)
        .sort((a, b) => a.d - b.d)
      out[key] = future[1]?.ts ?? null
    }
    return out
  }, [timetable, nowMinute, directions])

  if (directions.length === 0) {
    return (
      <ScheduleSection
        title={stationGroup}
        type="subway"
        routeCode={stationGroup}
        loading={false}
        disabled
        disabledLabel="정보 준비 중"
      />
    )
  }

  return (
    <>
      {directions.flatMap((dir) => [
        ...[
          { key: dir.upKey, label: dir.upLabel },
          { key: dir.downKey, label: dir.downLabel },
        ].map(({ key, label }) => {
          const entry = data?.[key]
          const depart = entry?.depart_at ?? null
          const mins = depart ? timeStrToMinutes(depart, now) : null
          const validMins = mins != null && mins >= 0 ? mins : null
          const secondDepart = secondDepartMap[key] ?? null
          const isLastTrain = depart != null && timetable != null && secondDepart == null
          const favCode = makeFavKey({ mode: 'subway', id: stationGroup, direction: key })
          if (favoritesOnly && !isFav(favCode)) return null
          const destLabel = SUBWAY_DEST_LABEL[key] ?? null
          const handleClick = () => {
            if (isDesktop) {
              onCardClick({
                type: 'subway',
                subwayKey: key,
                favCode,
                title: `${stationGroup} ${label}`,
                accentColor: dir.color,
              })
              return
            }
            setSubwayDetailSheet({
              station: stationGroup,
              lineName: dir.subtitle,
              timetableKey: key,
              direction: label,
              color: dir.color,
              darkColor: dir.darkColor,
              lightColor: dir.lightColor,
              symbol: dir.symbol,
            })
          }
          return (
            <ScheduleSection
              key={`${stationGroup}:${key}`}
              title={destLabel ? `${label} · ${destLabel}` : label}
              type="subway"
              routeCode={dir.subtitle}
              minutesUntil={validMins}
              hhmm={depart}
              imminent={validMins != null && validMins <= 1}
              subtitle={secondDepart ? `그 다음 ${secondDepart}` : null}
              onClick={handleClick}
              loading={loading}
              lastBus={isLastTrain}
              isFavorite={isFav(favCode)}
              onToggleFavorite={() => onToggleFav(favCode)}
              selected={isDesktop && selectedFavCode === favCode}
              footer={!loading && (
                <SubwayStationChips line={dir.subtitle} direction={label} viewStation={stationGroup} />
              )}
            />
          )
        }),
      ])}
    </>
  )
}

// ─── shuttle section ─────────────────────────────────────────────────────────
// 셔틀이 미운행일이면 다음 평일(월~금) 시간표를 폴백으로 보여줌.
// 본캠: 토·일 모두 미운행. 2캠(direction>=2): 일요일만 미운행(토요일은 운행).
function isShuttleOffDay(direction, d = new Date()) {
  const day = d.getDay()
  if (direction >= 2) return day === 0
  return day === 0 || day === 6
}

function nextWeekdayDateStr() {
  const d = new Date()
  const day = d.getDay()
  // 일요일(0) → +1, 토요일(6) → +2
  const offset = day === 0 ? 1 : day === 6 ? 2 : 0
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// KST 기준 오늘 'YYYY-MM-DD'. /shuttle/periods 의 start_date·end_date 와 같은
// 형식이라 문자열 비교로 기간을 판정할 수 있다.
function todayISOStr() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

// 'YYYY-MM-DD' → 'M/D'
function formatPeriodMD(dateStr) {
  const [, m, d] = (dateStr ?? '').split('-').map(Number)
  return m && d ? `${m}/${d}` : ''
}

// 평일인데 오늘 데이터가 비어 있을 때(방학 등)의 안내 문구.
// 예전에는 계절과 무관하게 "여름방학 중 미운행 · 2학기 개강 후 운행"을 하드코딩해
// 2학기가 시작된 뒤에도 같은 문구가 떴다(결함). /shuttle/periods 데이터에서 오늘이
// 속한 실제 기간명과, 있다면 다음 기간명을 읽어 문구를 만든다 — 어떤 기간인지
// 데이터로 확인되지 않으면 계절을 단정하지 않는 중립 문구로 폴백한다.
function buildShuttleWeekdayOffLabel(periods, todayStr) {
  const list = Array.isArray(periods) ? periods : []
  const current = pickCurrentPeriod(list, todayStr)
  if (!current) return '평일 정규 시간표 정보가 아직 없어요'
  const next = list
    .filter((p) => p.start_date > todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  return next
    ? `${current.name} 기간 · 평일 운행 정보 없음 (${next.name} ${formatPeriodMD(next.start_date)}부터 재개 예정)`
    : `${current.name} 기간 · 평일 운행 정보 없음`
}

function ShuttleSection({ direction, onCardClick, favoritesOnly = false, isFav, onToggleFav, selectedFavCode, isDesktop }) {
  const label = direction % 2 === 0 ? '등교' : '하교'
  const campusTag = direction >= 2 ? '2캠 ' : ''
  const titleText = `${campusTag}셔틀 ${label}`.trim()
  const favCode = makeFavKey({ mode: 'shuttle', id: direction >= 2 ? 'second' : 'main', direction: label })
  const today = useShuttleSchedule(direction)
  // 미운행일에만 다음 평일 폴백 fetch (enabled로 운행일에는 호출 안 함).
  // 본캠은 토·일 모두 미운행, 2캠은 일요일만 미운행이라 판정이 다르다.
  const offDay = isShuttleOffDay(direction)
  const fallbackDate = offDay ? nextWeekdayDateStr() : null
  const fallback = useShuttleSchedule(direction, fallbackDate, { enabled: offDay })
  // 평일인데 오늘 데이터가 빌 때(noSchedule 분기)만 실제 소비하지만, 조건부 훅
  // 호출은 금지이므로 항상 호출한다 — 응답은 1시간 TTL 공유 캐시라 추가 비용 없음.
  const periodsQuery = useShuttlePeriods()

  // 요청한 direction에 시간 데이터가 있는지로 판정.
  // (백엔드는 direction param을 받아도 다른 방향이 응답 directions에 포함될 수 있어서
  //  단순 length 체크는 본캠 0번이 비었는데 2캠 2번 데이터로 폴백이 안 켜지는 케이스를 놓침.)
  const findDirTimes = (apiData) => apiData?.directions?.find((d) => d.direction === direction)?.times ?? []
  const todayEmpty = !today.loading && (today.error || findDirTimes(today.data).length === 0)
  const fallbackHasData = findDirTimes(fallback.data).length > 0
  const usingFallback = offDay && todayEmpty && fallbackHasData

  const data = usingFallback ? fallback.data : today.data
  // 폴백 fetch가 끝날 때까지 loading 유지 (깜빡임 방지)
  const loading = today.loading || (offDay && fallback.loading)
  const error = today.error && (!offDay || fallback.error)

  if (favoritesOnly && !isFav(favCode)) return null

  const routeCode = `${campusTag}셔틀${label}`.trim()
  const rowBaseProps = {
    title: titleText,
    type: 'shuttle',
    routeCode,
    isFavorite: isFav(favCode),
    onToggleFavorite: () => onToggleFav(favCode),
    selected: isDesktop && selectedFavCode === favCode,
  }

  const noSchedule = !loading && (error || !data || (data.directions ?? []).length === 0)
  if (noSchedule) {
    // 오늘이 실제 미운행 요일일 때만 "주말·공휴일" 문구를 쓴다. 평일에 데이터가
    // 없는 경우(방학 등)에도 같은 문구가 나와서 월요일에 "주말 미운행"이 떴다.
    // "추후 업데이트 예정" 같은 거짓 약속 문구는 제거한다(결함: 셔틀 미운행 문구가
    // 사실과 다름) — 주말/공휴일은 원래 정규 운행이 없고, 평일인데 비어 있으면
    // 방학 기간일 가능성이 크다.
    const offLabel = !offDay
      ? buildShuttleWeekdayOffLabel(periodsQuery.data?.periods ?? [], todayISOStr())
      : direction >= 2
        ? '일요일·공휴일은 2캠 셔틀 정규 운행이 없어요'
        : '주말·공휴일은 셔틀 정규 운행이 없어요'
    return (
      <ScheduleSection
        {...rowBaseProps}
        loading={false}
        disabled
        timeLines={!offDay ? ['평일', '정보없음'] : (direction >= 2 ? ['일요일', '미운행'] : ['주말', '미운행'])}
        disabledLabel={offLabel}
      />
    )
  }

  // 폴백 모드: 평일 시간표를 통째로 보여주되 카운트다운/minutesUntil은 의미 없으므로 미사용.
  if (usingFallback) {
    const dirData = data?.directions?.find((d) => d.direction === direction)
    const allTimes = (dirData?.times ?? [])
      .map((t) => (typeof t === 'string' ? t : t?.depart_at))
      .filter((s) => typeof s === 'string' && s.length > 0)
      .map((s) => s.slice(0, 5))
    const first = allTimes[0] ?? null
    const second = allTimes[1] ?? null
    const extras = allTimes.slice(2, 6)
    const handleClick = () => onCardClick({ type: 'shuttle', routeCode, direction, favCode, title: `${campusTag}셔틀버스 ${label}` })

    return (
      <ScheduleSection
        {...rowBaseProps}
        timeLines={['평일', '기준']}
        subtitle={first ? `첫차 ${first}${second ? ` · 다음 ${second}` : ''}` : null}
        onClick={handleClick}
        loading={false}
        footer={extras.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
            {extras.map((t, i) => (
              <span key={`${t}-${i}`} style={{ fontSize: scaledPx(12), color: 'var(--tj-mute)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </span>
            ))}
          </div>
        )}
      />
    )
  }

  const now = new Date()
  const dirData = data?.directions?.find((d) => d.direction === direction)

  const rawEntries = (dirData?.times ?? []).map((t) =>
    typeof t === 'string' ? { depart_at: t, note: null } : { depart_at: t?.depart_at ?? '', note: t?.note ?? null }
  )
  const futureEntries = rawEntries.filter((e) => {
    const ts = (e.depart_at ?? '').slice(0, 5)
    if (!ts) return false
    const [h, m] = ts.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d > now && (d - now) <= 12 * 60 * 60 * 1000
  })

  const hasPastFrequent = rawEntries.some((e) => {
    if (e.note !== '수시운행') return false
    const ts = (e.depart_at ?? '').slice(0, 5)
    if (!ts) return false
    const [h, m] = ts.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d <= now
  })
  const inFrequent = hasPastFrequent && futureEntries[0]?.note === '수시운행'

  const MAX_SHUTTLE_ROWS = 4
  const handleClick = () => onCardClick({ type: 'shuttle', routeCode, direction, favCode, title: `${campusTag}셔틀버스 ${label}` })

  function buildRow(e) {
    const ts = e.depart_at?.slice(0, 5) ?? null
    const computed = ts ? timeStrToMinutes(ts, now) : null
    const minsPositive = computed != null && computed >= 0 ? computed : null
    const isReturn = e.note?.startsWith?.('회차편') ?? false
    const isFrequentReturn = isReturn && (e.note?.includes('수시운행') ?? false)
    const isFrequent = e.note === '수시운행'

    if (isFrequentReturn) {
      return {
        key: `t-${ts}-frequent-return`,
        departStr: null,
        mins: null,
        statusLabel: ts ? `수시 회차편 (${ts} 이후)` : '수시 회차편 대기',
        isReturn: true,
      }
    }
    if (isReturn) {
      // 결함 6: 예전엔 depart_at(ts)이 있는데도 시각 칸을 비우고 "회차편 탑승"
      // 문구만 넣어서, 등교 목록의 시각 칸에 시각이 아예 없었다. depart_at은
      // 이 회차편이 이 정류장에서 실제로 출발하는 시각(백엔드 note 필드
      // "회차편 · 학교 18:00 출발"과 함께 옴, curl로 실제 스키마 확인함)이라
      // 시각 칸에 그대로 쓴다. "회차편"이라는 사실과, 알 수 있으면 회차
      // 원본 버스가 학교를 출발한 시각(originTime)은 부제 쪽으로 옮긴다.
      const { originTime } = parseReturnNote(e.note)
      return {
        key: `t-${ts}-return`,
        departStr: ts,
        mins: minsPositive,
        statusLabel: originTime ? `회차편 · 학교 ${originTime} 출발` : '회차편',
        isReturn: true,
      }
    }
    return {
      key: `t-${ts}-${e.note ?? ''}`,
      departStr: ts,
      mins: minsPositive,
      statusLabel: isFrequent ? '수시운행' : null,
      isReturn,
    }
  }

  const rows = []
  if (inFrequent) {
    const endEntry = futureEntries.find((e) => e.note !== '수시운행')
    const endAt = endEntry?.depart_at?.slice(0, 5)
    rows.push({
      key: 'frequent',
      departStr: null,
      mins: null,
      statusLabel: endAt ? `${endAt}까지 수시운행` : '수시운행 중',
    })
    const post = futureEntries.filter((e) => e.note !== '수시운행')
    for (const e of post.slice(0, MAX_SHUTTLE_ROWS - 1)) {
      rows.push(buildRow(e))
    }
  } else {
    for (const e of futureEntries.slice(0, MAX_SHUTTLE_ROWS)) {
      rows.push(buildRow(e))
    }
  }

  if (rows.length === 0) {
    return (
      <ScheduleSection
        {...rowBaseProps}
        timeLines={['금일', '종료']}
        onClick={handleClick}
        loading={false}
      />
    )
  }

  const first = rows[0]
  const second = rows[1]
  const extras = rows.slice(2)
    .map((r) => r.departStr)
    .filter((s) => typeof s === 'string' && s.length > 0)
  // first가 시각을 갖지 않는 상태성 편(수시운행/수시 회차편 대기)이면 시간열에
  // 짧은 문구로, 그 외(회차편 포함, departStr이 있는 모든 편)는 통상 분
  // 카운트다운으로 표시한다. 회차편도 depart_at이 있으므로(결함 6) 더 이상
  // firstTimeLines 문구 분기를 타지 않는다.
  const firstTimeLines = first?.statusLabel && first.departStr == null
    ? first.statusLabel.split(' ').slice(0, 2)
    : null
  // first가 (수시 회차편 대기가 아닌) 일반 회차편이면 "다음 회차 예고"보다
  // "지금 시간열에 뜬 시각이 회차편이라는 사실"을 부제로 먼저 설명한다(결함 6
  // — 회차편이라는 사실을 시각 칸이 아닌 배지/부제로 옮기라는 요구, 시각 칸과
  // 같은 문구 중복 금지). 수시 회차편 대기(departStr == null)는 이미 시간열
  // 문구 자체가 상태를 설명하므로 제외한다 — 안 그러면 같은 말이 겹친다.
  const subtitleBottom = first?.isReturn && first.departStr != null
    ? first.statusLabel
    : second
      ? (second.statusLabel ?? (second.departStr ? `그 다음 ${second.departStr}` : null))
      : null
  return (
    <ScheduleSection
      {...rowBaseProps}
      timeLines={firstTimeLines}
      minutesUntil={firstTimeLines ? null : first?.mins ?? null}
      hhmm={firstTimeLines ? null : first?.departStr ?? null}
      imminent={!firstTimeLines && first?.mins != null && first.mins <= 1}
      subtitle={subtitleBottom}
      onClick={handleClick}
      loading={loading}
      footer={extras.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
          {extras.map((t, i) => (
            <span key={`${t}-${i}`} style={{ fontSize: scaledPx(12), color: 'var(--tj-mute)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    />
  )
}

// 하교는 방면(정왕역/시흥시청/서울/월곶) 탭 없이 노선당 한 줄(경유지 표기)로
// 통합한 단일 목록이다. 백엔드 /bus/commute-contexts는 group_key 하나만
// 받으므로, BUS_COMMUTE_GROUPS.하교에 남아있는 네 group_key를 모두 조회해
// 여기서 하나로 합친다. BUS_COMMUTE_GROUPS.하교 자체는 지우지 않는다 —
// ScheduleDetailModal이 같은 배열로 "노선이 여러 group_key에 걸리는지"를
// 확인해 상세 안 방면 전환 탭을 띄우는데, DB 쪽 중복 컨텍스트를 정리한 뒤로는
// 하교 노선이 두 group_key에 동시에 남지 않아 그 탭도 자연히 뜨지 않는다.
const HAGYO_GROUP_KEYS = (BUS_COMMUTE_GROUPS.하교 ?? []).map((group) => group.id)

// ─── bus group content (동적 API 로드) ─────────────────────────────────────
function BusGroupContent({ busGroup, commuteGroup, onCardClick, favoritesOnly = false, isFav, onToggleFav, selectedFavCode, isDesktop }) {
  const { data: routes, loading } = useBusRoutesByCategory(busGroup)
  const isHagyo = busGroup === '하교'
  // 훅 호출 순서를 매 렌더 동일하게 유지하려고 하교 여부와 무관하게 항상
  // 4개 group_key 훅 + 단일 group_key 훅을 호출한다. ready 플래그(category를
  // null로 넘김)로 실제 요청 여부만 가른다.
  const hagyoCtx0 = useBusCommuteContexts(isHagyo ? '하교' : null, HAGYO_GROUP_KEYS[0])
  const hagyoCtx1 = useBusCommuteContexts(isHagyo ? '하교' : null, HAGYO_GROUP_KEYS[1])
  const hagyoCtx2 = useBusCommuteContexts(isHagyo ? '하교' : null, HAGYO_GROUP_KEYS[2])
  const hagyoCtx3 = useBusCommuteContexts(isHagyo ? '하교' : null, HAGYO_GROUP_KEYS[3])
  const singleCtx = useBusCommuteContexts(!isHagyo ? busGroup : null, commuteGroup)
  const usesContexts = Boolean(BUS_COMMUTE_GROUPS[busGroup])

  const hagyoQueries = [hagyoCtx0, hagyoCtx1, hagyoCtx2, hagyoCtx3]
  const contextsLoading = isHagyo
    ? hagyoQueries.some((query) => query.loading)
    : singleCtx.loading
  const anyContextDataLoaded = isHagyo
    ? hagyoQueries.some((query) => query.data != null)
    : singleCtx.data != null
  const commuteContexts = isHagyo
    ? hagyoQueries.flatMap((query) => (Array.isArray(query.data) ? query.data : []))
    : (singleCtx.data ?? [])

  // 도착순 정렬(시안 1-A) — BusRouteSection이 각자 화면에 보여주는 도착 분을
  // 보고하는 맵. 초기엔 비어 있다가(=정보 없음 취급) 자식들이 useEffect로
  // 채우며 정렬이 재계산된다.
  const [arrivalMap, setArrivalMap] = useState({})
  const reportArrival = useCallback((favCode, minutesUntil) => {
    setArrivalMap((prev) => (prev[favCode] === minutesUntil ? prev : { ...prev, [favCode]: minutesUntil }))
  }, [])

  // 그룹 전환 시 stale 도착 정보를 비워서 새 그룹이 자체 보고로 채우게 한다.
  // 렌더 중 조정 — effect로 미루면 이전 그룹의 정렬로 한 프레임이 그려진다.
  const [seenBusGroup, setSeenBusGroup] = useState(busGroup)
  if (busGroup !== seenBusGroup) {
    setSeenBusGroup(busGroup)
    setArrivalMap({})
  }

  if ((usesContexts ? contextsLoading && !anyContextDataLoaded : loading && !routes)) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface-2 dark:bg-surface rounded-tile animate-pulse" />
        ))}
      </>
    )
  }

  const rawRouteList = Array.isArray(routes) ? routes : []
  const contextList = Array.isArray(commuteContexts) ? commuteContexts : []
  const entries = (usesContexts ? contextList : rawRouteList.map((route) => ({
    id: route.route_id,
    route_id: route.route_id,
    route_number: route.route_number,
    category: route.category,
    group_key: null,
    origin_label: route.stops?.[0]?.name ?? '정류장',
    destination_label: route.direction_name ?? '운행 정보',
    journey_labels: [route.stops?.[0]?.name, route.direction_name].filter(Boolean),
    sources: [],
  }))).map((context) => {
    // favKey 스키마(utils/favKey.js): mode='bus', id=route_id(우선)|route_number,
    // direction=busGroup(하교/등교/기타). 레거시 저장값(순수 route_number,
    // "${busGroup}:${routeNo}")은 SchedulePage의 isFav()가 matchesLegacy로
    // 계속 인식한다(결함 #20 — 별 저장/필터 스키마 불일치 수정).
    const favCode = makeFavKey({ mode: 'bus', id: context.route_id ?? context.route_number, direction: busGroup })
    return {
      code: context.route_number,
      favCode,
      originLabel: context.origin_label,
      commuteContext: context,
    }
  })

  // 정렬 규칙(시안 1-A, 사용자 실측 — "9분짜리가 맨 아래" 문제 수정):
  // ① 도착 시각이 확인된 카드를 도착까지 남은 시간 오름차순으로 위에
  // ② 도착 정보가 없는 노선(운행 정보 없음·아직 보고 전)은 모두 아래로 묶고,
  //    그 안에서는 색상(카테고리: 광역→간선→시내) 순
  // ③ 동일 카테고리는 출발 정류장(originLabel)으로 안정 정렬.
  const sorted = [...entries].sort((a, b) => {
    const am = arrivalMap[a.favCode]
    const bm = arrivalMap[b.favCode]
    const aKnown = typeof am === 'number'
    const bKnown = typeof bm === 'number'
    if (aKnown !== bKnown) return aKnown ? -1 : 1
    if (aKnown) return am - bm
    const orderA = ROUTE_CATEGORY_ORDER.indexOf(getRouteCategory(a.code))
    const orderB = ROUTE_CATEGORY_ORDER.indexOf(getRouteCategory(b.code))
    if (orderA !== orderB) return orderA - orderB
    return (a.originLabel ?? '').localeCompare(b.originLabel ?? '', 'ko')
  })
  const displayEntries = favoritesOnly
    ? sorted.filter((e) => isFav(e.favCode, e.code))
    : sorted

  if (displayEntries.length === 0) {
    return (
      <p className="py-8 text-center text-body text-mute">
        {favoritesOnly ? '즐겨찾기한 노선이 없어요' : '해당 그룹의 버스가 없어요'}
      </p>
    )
  }

  // 3400 등교(강남 출발) 주말 시간표는 공식 자료(2022.3.10~) 기반이라 실제 운행과 차이가 날 수 있음.
  const todayDow = new Date().getDay()
  const showWeekend3400Notice =
    busGroup === '등교' &&
    (todayDow === 0 || todayDow === 6) &&
    displayEntries.some((e) => e.code === '3400')

  return (
    <>
      {showWeekend3400Notice && (
        <div
          role="status"
          className="rounded-card bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-2.5 flex items-start gap-2"
        >
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">3400번 주말·휴일 강남 출발 시간표는 실제와 다를 수 있어요.</span>
            {' '}정확한 도착은 카카오버스 같은 실시간 앱을 함께 참고하세요.
          </p>
        </div>
      )}
      {displayEntries.map((e) => (
        <BusRouteSection
          key={e.favCode}
          busGroup={busGroup}
          commuteContext={e.commuteContext}
          favCode={e.favCode}
          onCardClick={onCardClick}
          onArrivalChange={reportArrival}
          isFavorite={isFav(e.favCode, e.code)}
          onToggleFavorite={() => onToggleFav(e.favCode)}
          selected={isDesktop && selectedFavCode === e.favCode}
        />
      ))}
    </>
  )
}

// 즐겨찾기 필터를 켰지만 해당 모드에 즐겨찾기가 없을 때의 안내.
function FavoritesEmpty() {
  return (
    <EmptyState
      size="sm"
      icon={<Star size={24} aria-hidden="true" />}
      title="즐겨찾기한 노선이 없어요"
      desc="노선 카드의 별을 누르면 여기에 모여요."
    />
  )
}

// ─── main component ──────────────────────────────────────────────────────────
/**
 * @param embedded   홈의 "시간표" 보기로 얹혀 있을 때 true.
 *   이때 모드의 단일 출처는 홈의 ModeTabs(store.selectedMode)다 — 자체 헤더와
 *   모드 탭을 그리지 않고, 주소도 건드리지 않는다(홈이 주소를 소유한다).
 *   지금/시간표 전환은 하단 독의 홈/시간표 탭이 맡는다(예전엔 이 자리에
 *   viewSwitch prop으로 셀렉터를 그렸으나, 독 탭과 상태를 이중으로 조작해
 *   사용자가 헷갈렸다 — Dashboard.jsx 주석 참고) — 그 자리는 지금 비운다.
 */
export default function SchedulePage({ embedded = false }) {
  const isDesktop = useIsDesktop()
  const [query, setQuery] = useState(readQuery)

  useEffect(() => {
    const sync = () => setQuery(readQuery())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const storedMode = useAppStore((s) => s.selectedMode)
  const setStoredMode = useAppStore((s) => s.setSelectedMode)
  const shuttleCampus = useAppStore((s) => s.selectedShuttleCampus)
  const setShuttleCampus = useAppStore((s) => s.setShuttleCampus)
  const scheduleHint = useAppStore((s) => s.scheduleHint)
  const setScheduleHint = useAppStore((s) => s.setScheduleHint)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteKey = useAppStore((s) => s.toggleFavoriteKey)
  const setMapPanTarget = useAppStore((s) => s.setMapPanTarget)

  const initialMode = isValidMode(query.type)
    ? query.type
    : (isValidMode(storedMode) ? storedMode : 'bus')

  const [mode, setMode] = useState(initialMode)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [busGroup, setBusGroup] = useState('하교')
  const [busCommuteGroup, setBusCommuteGroup] = useState(BUS_COMMUTE_GROUPS.하교[0].id)
  const [subwayGroup, setSubwayGroup] = useState('정왕')
  const [selectedDetail, setSelectedDetail] = useState(null)

  // 주소의 type이 바뀌면(뒤로가기 등) 화면 모드를 맞춘다. 렌더 중 조정이라
  // 이전 모드로 한 프레임이 그려지지 않는다.
  if (!embedded && isValidMode(query.type) && query.type !== mode) {
    setMode(query.type)
  }

  // 홈에 얹혀 있으면 모드는 홈이 정한다. 여기서도 렌더 중에 맞춰야 이전 모드의
  // 목록이 한 프레임 보이지 않는다(useApi 의 path 리셋과 같은 이유).
  if (embedded && isValidMode(storedMode) && storedMode !== mode) {
    setMode(storedMode)
    setSelectedDetail(null)
  }

  // /schedule 로 바로 들어오면 저장된 모드(storedMode)가 화면을 결정하는데, URL에는
  // 그 사실이 안 남아 링크를 공유하면 상대가 다른 탭을 보게 된다. 마운트 시 현재
  // 모드를 URL에 한 번 반영해 주소가 항상 화면 상태를 나타내게 한다.
  useEffect(() => {
    if (!embedded && !isValidMode(query.type)) navigateSchedule({ type: mode })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 힌트로 넘어온 모드/그룹은 렌더 중에 반영한다(로컬 state). 스토어를 비우는
  // 일은 다른 컴포넌트에 영향을 주므로 렌더가 끝난 뒤 effect에서 한다.
  const [seenHint, setSeenHint] = useState(null)
  if (scheduleHint && scheduleHint !== seenHint) {
    setSeenHint(scheduleHint)
    if (isValidMode(scheduleHint.mode)) {
      setMode(scheduleHint.mode)
      setStoredMode(scheduleHint.mode)
    }
    if (scheduleHint.group) {
      if (scheduleHint.mode === 'bus') setBusGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'subway') setSubwayGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'shuttle') {
        if (scheduleHint.group === 'main' || scheduleHint.group === 'second') setShuttleCampus(scheduleHint.group)
      }
    }
  }
  useEffect(() => {
    if (scheduleHint) setScheduleHint(null)
  }, [scheduleHint, setScheduleHint])

  function handleModeChange(next) {
    if (next === mode) return
    setMode(next)
    // replaceState는 popstate를 발생시키지 않는다. URL만 바꾸고 query state를
    // 갱신하지 않으면 아래 URL→mode 동기화가 이전 query.type으로 탭을 되돌린다.
    setQuery({ type: next, route: null, stop: null })
    setStoredMode(next)
    // PC 2단에서는 우측 상세가 이전 모드의 노선을 계속 보여주는 문제가 있었다
    // (버스에서 지하철 상세를 연 뒤 셔틀 탭으로 가면 지하철 상세가 남음).
    setSelectedDetail(null)
    // 임베드(홈/지도 탭의 "시간표" 보기)일 때 주소는 호스트 것이다. 여기서
    // /schedule 로 덮어쓰면 새로고침이나 링크 공유에서 지도 대신 독립
    // 시간표 페이지가 열려, 지도 탭에 머물러 있다는 전제가 깨진다.
    if (!embedded) navigateSchedule({ type: next })
  }

  // favKey 스키마(utils/favKey.js) 단일화 — 별 저장은 항상 favorites.keys에
  // toggleFavoriteKey로 쓰고, 조회는 favorites.keys(신규) + favorites.routes(레거시)
  // 양쪽을 matchesLegacy로 함께 본다. legacyRouteNumber는 순수 노선번호 또는
  // "${busGroup}:${routeNo}" 형태로 예전에 저장된 즐겨찾기(예: BusArrivalCard의
  // useFavorites 훅, 대시보드 등 다른 화면에서 저장한 값)까지 인식하기 위함이다
  // (결함 #20 — 별 저장 스키마와 필터 비교 스키마가 달라 필터가 항상 비었던 버그).
  function isFav(favKey, legacyRouteNumber = null) {
    if (!favKey) return false
    if (matchesLegacy(favorites.keys ?? [], { favKey })) return true
    return matchesLegacy(favorites.routes ?? [], { routeNumber: legacyRouteNumber, favKey })
  }
  const handleToggleFav = (favKey) => toggleFavoriteKey(favKey)
  // 시간표에서 연 상세는 모바일 바텀시트/PC 우측 패널이 같은 통학 맥락 데이터를
  // 사용한다. 별도 RouteDetailPage로 보내면 category/commuteGroup이 유실돼 한 화면에
  // 다른 출발지·방면 데이터가 다시 섞이므로 이 화면 안에서만 상세를 전환한다.
  function handleCardClick(detail) {
    setSelectedDetail(detail)
  }
  const handleModalClose = () => setSelectedDetail(null)

  const groups =
    mode === 'bus' ? BUS_GROUP_IDS
    : mode === 'subway' ? SUBWAY_GROUPS
    : mode === 'shuttle' ? SHUTTLE_CAMPUS_GROUPS
    : []
  const activeGroupId =
    mode === 'bus' ? busGroup
    : mode === 'subway' ? subwayGroup
    : mode === 'shuttle' ? shuttleCampus
    : null
  const setGroupRaw =
    mode === 'bus' ? setBusGroup
    : mode === 'subway' ? setSubwayGroup
    : mode === 'shuttle' ? setShuttleCampus
    : () => {}
  // 그룹(하교/등교, 정왕/초지 등)을 바꿔도 우측 상세는 이전 그룹의 노선을 그대로
  // 들고 있어 좌우가 어긋났다. 모드 전환과 같은 이유로 선택을 비운다.
  const setActiveGroup = (next) => {
    setSelectedDetail(null)
    if (mode === 'bus') {
      setBusCommuteGroup(BUS_COMMUTE_GROUPS[next]?.[0]?.id ?? null)
    }
    setGroupRaw(next)
  }
  const setActiveCommuteGroup = (next) => {
    setSelectedDetail(null)
    setBusCommuteGroup(next)
  }
  const handleFavoritesOnlyChange = (next) => {
    setSelectedDetail(null)
    setFavoritesOnly(next)
  }

  const detailModalProps = {
    open: selectedDetail != null,
    onClose: handleModalClose,
    type: selectedDetail?.type,
    routeCode: selectedDetail?.routeCode,
    routeId: selectedDetail?.routeId ?? null,
    stopId: selectedDetail?.stopId ?? null,
    category: selectedDetail?.category ?? null,
    commuteGroup: selectedDetail?.commuteGroup ?? null,
    realtimeStationId: selectedDetail?.realtimeStationId ?? null,
    commuteContext: selectedDetail?.commuteContext ?? null,
    direction: selectedDetail?.direction,
    subwayKey: selectedDetail?.subwayKey,
    accentColor: selectedDetail?.accentColor,
    isRealtime: selectedDetail?.isRealtime ?? false,
    title: selectedDetail?.title ?? '',
    isFavorite: selectedDetail?.favCode ? isFav(selectedDetail.favCode, selectedDetail?.routeCode) : false,
    onToggleFav: selectedDetail?.favCode ? () => handleToggleFav(selectedDetail.favCode) : null,
    onShowMap:
      selectedDetail?.mapLat != null && selectedDetail?.mapLng != null
        ? () => {
            setMapPanTarget({ lat: selectedDetail.mapLat, lng: selectedDetail.mapLng })
            handleModalClose()
            if (window.location.pathname !== '/') {
              window.history.pushState({}, '', '/')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }
          }
        : null,
  }

  // 즐겨찾기 필터를 켰을 때 지하철/셔틀은 각 행이 개별적으로 null을 반환해 화면이
  // 통째로 백지가 됐다(버스만 자체 빈 상태가 있었다). 해당 모드에 즐겨찾기가 하나라도
  // 있는지 먼저 판정해 안내를 띄운다. 신규(favorites.keys)·레거시(favorites.routes)
  // 저장값을 모두 본다.
  const allFavKeys = [...(favorites.keys ?? []), ...(favorites.routes ?? [])]
  const hasFavoriteInMode = !favoritesOnly || (
    mode === 'subway'
      ? allFavKeys.some((c) => typeof c === 'string' && c.startsWith(`subway:${subwayGroup}:`))
      : mode === 'shuttle'
        ? allFavKeys.some((c) => {
            if (typeof c !== 'string' || !c.startsWith('shuttle:')) return false
            const isSecondKey = c.includes(':second:') || c.includes('2캠')
            return shuttleCampus === 'second' ? isSecondKey : !isSecondKey
          })
        : true
  )

  const sectionViewProps = {
    mode,
    handleModeChange,
    favoritesOnly,
    setFavoritesOnly: handleFavoritesOnlyChange,
    groups,
    activeGroupId,
    setActiveGroup,
    busGroup,
    busCommuteGroup,
    setActiveCommuteGroup,
    subwayGroup,
    shuttleCampus,
    handleCardClick,
    isFav,
    onToggleFav: handleToggleFav,
    selectedFavCode: selectedDetail?.favCode ?? null,
    isDesktop,
    hasFavoriteInMode,
    onOpenStats: () => setStatsOpen(true),
    embedded,
  }

  return (
    <div
      className={`flex flex-col h-full bg-surface dark:bg-bg ${embedded ? '' : 'animate-fade-in-up'}`}
      style={embedded ? undefined : { paddingTop: 'var(--banner-h, 0px)' }}
    >
      {!embedded && <PageHeader title="시간표" />}

      {isDesktop && !embedded ? (
        // PC · /schedule 단독 페이지 시안: 좌(노선 리스트+요일) / 우(선택한 노선의
        // 그리드+통계). 데이터 훅은 그대로 재사용 — 모바일의 리스트/모달 컴포넌트를
        // 레이아웃만 갈아끼운다. embedded일 때는 이 분기를 타지 않는다(아래 참고).
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* 좌측 리스트 폭은 화면 크기에 따라 넓힌다. 380px 고정일 때는 노선명이
              잘려("20-1 아…") 어디 가는 차인지 알 수 없는데도 우측은 1300px가
              비어 있었다. */}
          <div className="w-[380px] xl:w-[440px] 2xl:w-[500px] flex-shrink-0 h-full flex flex-col overflow-hidden border-r border-line dark:border-line">
            <ScheduleSectionView {...sectionViewProps} />
          </div>
          <div className="flex-1 min-w-0 h-full overflow-hidden bg-bg dark:bg-bg flex justify-center">
            {/* 우측 상세 패널은 최대 720px로 제한 — 초광폭 화면에서 시간표 한 줄이
                끝없이 늘어나지 않게 한다. */}
            <div className="w-full max-w-[720px] h-full min-w-0">
              {selectedDetail != null
                ? <ScheduleDetailModal {...detailModalProps} pcMode="inline" />
                : <ScheduleDetailEmptyState />}
            </div>
          </div>
        </div>
      ) : isDesktop && embedded ? (
        // PC · 홈 도킹 패널에 얹힌 시간표(PCMainShell aside, 폭 380~440px).
        //
        // 예전엔 이 갈래가 없어서 embedded에서도 isDesktop만 보고 위 좌(목록)/
        // 우(상세) 2단 분기를 그대로 탔다. isDesktop은 window.matchMedia
        // (min-width:768px)만 보고 판정하는데, aside 자체가 그보다 훨씬 좁은
        // 컨테이너라 그 안에 다시 "w-[380px] 목록 + 나머지 상세" 2단을 욱여넣은
        // 꼴이 됐다 — 상세 컬럼 폭이 사실상 0에 가깝게 눌려 잘리거나 넘쳤다.
        //
        // 좁은 폭에서는 목록/상세를 나란히 두지 않고 목록 ↔ 상세 전환(드릴다운)으로
        // 처리한다. ScheduleDetailModal의 pcMode="inline"은 "portal/fixed 없이
        // 부모 컨테이너를 그대로 채운다"는 계약이라, 부모를 aside 전체로 주면
        // 목록 자리를 통째로 상세로 바꿔치기하는 데도 그대로 재사용할 수 있다.
        selectedDetail != null
          ? <div className="flex-1 min-h-0 flex flex-col overflow-hidden"><ScheduleDetailModal {...detailModalProps} pcMode="inline" /></div>
          : <ScheduleSectionView {...sectionViewProps} />
      ) : (
        <ScheduleSectionView {...sectionViewProps} />
      )}

      <StatsSheet open={statsOpen} onClose={() => setStatsOpen(false)} />

      {/* /schedule 단독 페이지(PC)와 embedded PC 모두 위에서 pcMode="inline"으로
          이미 렌더한다 — 모바일(embedded 여부 무관)의 바텀시트만 추가로 마운트. */}
      {!isDesktop && <ScheduleDetailModal {...detailModalProps} />}
    </div>
  )
}

// ─── schedule section view ──────────────────────────────────────────────────
function ScheduleSectionView({
  mode,
  handleModeChange,
  favoritesOnly,
  setFavoritesOnly,
  groups,
  activeGroupId,
  setActiveGroup,
  busGroup,
  busCommuteGroup,
  setActiveCommuteGroup,
  subwayGroup,
  shuttleCampus,
  handleCardClick,
  isFav,
  onToggleFav,
  selectedFavCode,
  isDesktop,
  hasFavoriteInMode,
  onOpenStats,
  embedded = false,
}) {
  return (
    <>
      {/* 모드 탭 + 통계·즐겨찾기 유틸. 탭은 flex-1로 행을 채우고 유틸 버튼은 우측에
          고정. 홈에 얹힌 경우 모드 탭은 홈이 이미 그렸으니 여기서는 다시 그리지
          않는다 — 그 자리에 있던 지금/시간표 전환 셀렉터는 하단 독의 홈/시간표
          탭으로 옮겨갔다(SchedulePage 파일 상단 JSDoc 참고). 아래 그룹 탭과 같은
          SegmentedControl을 쓴다 — 예전엔 이 자리만 별도 ui/SegmentTabs를 써서
          한 화면 안에서 세그먼트 스타일이 갈렸다. */}
      <div className="px-4 pt-2 pb-1.5 flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          {!embedded && (
            <SegmentedControl
              options={MODES}
              value={mode}
              onChange={handleModeChange}
              ariaLabel="교통수단 모드 선택"
            />
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {/* 예전엔 30px 원형 버튼이라 44px 터치 타깃 규정에 못 미쳤다 —
              ui/IconButton(md=44px)으로 옮긴다. */}
          <IconButton
            onClick={onOpenStats}
            label="오늘의 교통 통계 보기"
            variant="ghost"
          >
            <BarChart3 size={14} strokeWidth={2.2} aria-hidden="true" />
          </IconButton>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            aria-label={favoritesOnly ? '즐겨찾기만 보기 해제' : '즐겨찾기한 노선만 보기'}
            className="pressable"
            style={{
              padding: '6px 11px',
              borderRadius: 999,
              border: favoritesOnly
                ? '1.5px solid var(--tj-pill-active-bg)'
                : '1.5px solid var(--tj-line)',
              background: favoritesOnly ? 'var(--tj-pill-active-bg)' : 'transparent',
              color: favoritesOnly ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
              fontSize: scaledPx(12),
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition:
                'background var(--dur-motion-base) var(--e-out), color var(--dur-motion-base) var(--e-out), border-color var(--dur-motion-base) var(--e-out)',
            }}
          >
            ★ 즐겨찾기
          </button>
        </div>
      </div>

      {/* 그룹 탭 — 대시보드와 동일한 SegmentedControl(민트 칩 대신 일관된 세그먼트). */}
      {groups.length > 0 && (
        <div className="px-4 pb-1.5 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <SegmentedControl
              options={groups.map((g) => ({ value: g.id, label: g.label }))}
              value={activeGroupId}
              onChange={setActiveGroup}
              ariaLabel="그룹 선택"
            />
          </div>
        </div>
      )}

      {/* 하교는 방면 탭을 두지 않는다 — 노선마다 경유지(journey_labels)를
          한 줄로 보여주는 단일 목록이다(BusGroupContent가 네 group_key를
          모두 합쳐 조회). 등교는 출발지가 서로 다른 노선이라 탭을 유지한다. */}
      {mode === 'bus' && busGroup !== '하교' && (BUS_COMMUTE_GROUPS[busGroup]?.length ?? 0) > 0 && (
        <div className="px-4 pb-1.5 flex-shrink-0">
          <SegmentedControl
            options={BUS_COMMUTE_GROUPS[busGroup].map((group) => ({ value: group.id, label: group.label }))}
            value={busCommuteGroup}
            onChange={setActiveCommuteGroup}
            ariaLabel="등교 출발지 선택"
          />
        </div>
      )}

      {/* content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
        {(mode === 'bus' || mode === 'subway' || mode === 'shuttle') && (
          <HolidayMetaBanner mode={mode} shuttleCampus={shuttleCampus} />
        )}
        <div key={mode} className="flex flex-col gap-2 animate-fade-in">
          {mode === 'bus' && (
            <BusGroupContent
              busGroup={busGroup}
              commuteGroup={busCommuteGroup}
              onCardClick={handleCardClick}
              favoritesOnly={favoritesOnly}
              isFav={isFav}
              onToggleFav={onToggleFav}
              selectedFavCode={selectedFavCode}
              isDesktop={isDesktop}
            />
          )}
          {mode === 'subway' && (
            hasFavoriteInMode ? (
              <SubwaySection
                stationGroup={subwayGroup}
                onCardClick={handleCardClick}
                favoritesOnly={favoritesOnly}
                isFav={isFav}
                onToggleFav={onToggleFav}
                selectedFavCode={selectedFavCode}
              />
            ) : (
              <FavoritesEmpty />
            )
          )}
          {mode === 'shuttle' && (
            hasFavoriteInMode ? (
              (SHUTTLE_CAMPUS_DIRECTIONS[shuttleCampus] ?? SHUTTLE_CAMPUS_DIRECTIONS.main).map((g) => (
                <ShuttleSection
                  key={`${shuttleCampus}:${g.id}`}
                  direction={g.direction}
                  onCardClick={handleCardClick}
                  favoritesOnly={favoritesOnly}
                  isFav={isFav}
                  onToggleFav={onToggleFav}
                  selectedFavCode={selectedFavCode}
                  isDesktop={isDesktop}
                />
              ))
            ) : (
              <FavoritesEmpty />
            )
          )}
        </div>
      </div>
    </>
  )
}

// ─── holiday meta banner ─────────────────────────────────────────────────────
// SubwaySection / ShuttleSection 이 내부적으로 동일 hook을 또 호출하므로
// useApi 의 shared cache 덕분에 추가 네트워크 비용은 발생하지 않는다.
function HolidayMetaBanner({ mode, shuttleCampus }) {
  // 지하철: timetable 응답에 is_holiday/holiday_name
  // 셔틀: schedule 응답에 is_holiday/holiday_name (캠퍼스/방향 무관 — 어느 direction 호출해도 같음)
  const { data: subwayTimetable } = useSubwayTimetable()
  const shuttleDir = shuttleCampus === 'second' ? 2 : 0
  const { data: shuttleSchedule } = useShuttleSchedule(shuttleDir)

  if (mode === 'subway') {
    return (
      <HolidayBanner
        isHoliday={Boolean(subwayTimetable?.is_holiday)}
        holidayName={subwayTimetable?.holiday_name ?? null}
      />
    )
  }
  if (mode === 'shuttle') {
    return (
      <HolidayBanner
        isHoliday={Boolean(shuttleSchedule?.is_holiday)}
        holidayName={shuttleSchedule?.holiday_name ?? null}
      />
    )
  }
  if (mode === 'bus') {
    // 버스 시간표도 공휴일엔 요일 타입이 바뀌지만(주말/휴일 다이어그램),
    // /bus 쪽 응답에는 아직 is_holiday/holiday_name 메타가 없다(백엔드 필드
    // 부재 — 다른 담당 영역). "오늘이 공휴일"이라는 사실 자체는 교통수단과
    // 무관한 달력 사실이라, 이미 불러온 지하철 timetable의 메타를 그대로
    // 재사용한다(useApi 공유 캐시라 추가 네트워크 비용 없음).
    return (
      <HolidayBanner
        isHoliday={Boolean(subwayTimetable?.is_holiday)}
        holidayName={subwayTimetable?.holiday_name ?? null}
      />
    )
  }
  return null
}
