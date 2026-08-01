import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import {
  useBusArrivals,
  useBusRoutesByCategory,
  useBusTimetable,
  useBusTimetableByRoute,
} from '../../hooks/useBus'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { SkeletonArrivalCard } from '../common/Skeleton'
import ErrorState from '../ui/ErrorState'
import TransitCard from '../ui/TransitCard.jsx'
import { formatEta } from '../../utils/eta'
import { arrivalEntryToSeconds, arrivalSecondsToMinutes, groupArrivalsByRoute } from '../../utils/busArrivalRows'
import {
  getGbisStationId,
  getPerRouteDisplay, getRoutesFor,
  getRouteDisplayConfig, getOriginLabel,
  getAllowedDirections,
  getRouteTitleAndVia,
} from '../dashboard/busStationConfig'

const DEFAULT_ROUTE_COLOR = '#64748B'
// 결함 #3 — "5분 이하"가 곧 도착 섹션 + 임박(색만) 톤의 기준. 기존 IMMINENT_THRESHOLD_SEC(60초,
// "곧 도착" 라벨 전환용)와는 별개 — 이 파일이 새로 정의하는 대시보드 카드 전용 규칙이다.
const SOON_THRESHOLD_SEC = 5 * 60

const CROWDED_META = {
  1: { label: '여유', tone: 'neutral' },
  2: { label: '보통', tone: 'neutral' },
  3: { label: '혼잡', tone: 'warn' },
  4: { label: '혼잡', tone: 'warn' },
}

/** 카드 탭 시 노선 상세로 이동 — 기존 ArrivalRow.handleClick과 동일 네비게이션 패턴. */
function navigateToBusRoute(routeNumber, station) {
  const routeId = `bus:${routeNumber}`
  const stopQuery = station ? `?stop=${encodeURIComponent(station)}` : ''
  const url = `/route/${routeId}${stopQuery}`
  window.history.pushState({ routeId }, '', url)
  window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
}

/**
 * BusPanel — 결함 #3/#13/#16/#17/#27 리디자인.
 *
 * - 모든 카드를 TransitCard로 통일. title은 행선지 풀네임(getRouteTitleAndVia),
 *   출발지/탑승지는 subtitle 한 줄로("한국공대 출발"류 반복은 리스트 상단에서 하지 않고
 *   각 카드에 얹는다 — 정류장별로 노선마다 출발지가 다를 수 있어 카드 단위가 정확하다).
 * - 칩 순서 고정: 실시간 → 혼잡 → 경유.
 * - 임박(ETA≤5분)은 eta.primary.tone='imminent'(색만) — 카드 보더/배경은 그대로.
 * - 실시간 미연결(도착 데이터는 있지만 arrive_in_seconds가 없는) 노선은 "실시간 연결 중"
 *   칩 + 시간표 폴백 ETA로 "운행 중" 섹션에 유지된다.
 * - 섹션: 곧 도착(ETA≤5분) / 운행 중(ETA순) / 오늘 미운행 · N(접힘, 기본 접힘).
 */
export default function BusPanel() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const { direction: selectedBusDirection } = useEffectiveDirection()
  const gbisStationId = getGbisStationId(selectedBusStation)

  // gbis 정류장(한국공학대/이마트/시흥시청): arrivals API 통합 사용
  const arrivalsQuery = useBusArrivals(gbisStationId)

  // 서울 정류장: 기존 whitelist 방식 유지
  const isSeoulStation = gbisStationId === null
  const allowedRouteNumbers = useMemo(
    () => new Set(getRoutesFor(selectedBusStation, selectedBusDirection)),
    [selectedBusStation, selectedBusDirection]
  )
  const routesQuery = useBusRoutesByCategory(isSeoulStation ? selectedBusDirection : null)
  const seoulRoutes = useMemo(
    () => (routesQuery.data ?? []).filter((r) => allowedRouteNumbers.has(r.route_number)),
    [routesQuery.data, allowedRouteNumbers]
  )

  if (isSeoulStation) {
    return (
      <div className="space-y-2">
        {routesQuery.loading && <SkeletonArrivalCard />}
        {routesQuery.error && !routesQuery.loading && (
          <ErrorState message="노선 정보 오류" onRetry={routesQuery.refetch} className="py-4" />
        )}
        {!routesQuery.loading && seoulRoutes.length === 0 && (
          <div className="text-caption text-mute py-6 text-center">노선이 없습니다</div>
        )}
        {seoulRoutes.length > 0 && (
          <h3 className="text-[12px] font-bold text-mute">운행 중</h3>
        )}
        {seoulRoutes.map((route) => (
          <SeoulRouteCard
            key={route.route_id}
            route={route}
            selectedBusStation={selectedBusStation}
            selectedBusDirection={selectedBusDirection}
          />
        ))}
      </div>
    )
  }

  // gbis 정류장: arrivals 통합 렌더링
  if (arrivalsQuery.loading) return <SkeletonArrivalCard />
  if (arrivalsQuery.error && !arrivalsQuery.data) {
    return <ErrorState message="버스 정보 오류" onRetry={arrivalsQuery.refetch} className="py-4" />
  }

  const arrivals = arrivalsQuery.data?.arrivals ?? []

  // 방향 필터: 선택 정류장의 허용 방향에 맞는 arrivals만 표시
  const allowedDirs = getAllowedDirections(selectedBusStation)
  const filteredArrivals = arrivals.filter(
    (a) => !a.category || allowedDirs.includes(a.category)
  )

  if (filteredArrivals.length === 0) {
    return (
      <div className="text-caption text-mute py-6 text-center">
        실시간 정보를 가져오는 중이에요. 잠시 후 다시 확인해 주세요.
      </div>
    )
  }

  const routeGroups = groupArrivalsByRoute(filteredArrivals)

  // 실시간 ETA가 있는 그룹 / 없는 그룹(실시간 미연결 → 시간표 폴백)으로 분리
  const liveRows = []
  const fallbackGroups = []
  for (const group of routeGroups) {
    const a = group[0]
    const sec = arrivalEntryToSeconds(a)
    if (sec == null && !a.is_tomorrow) {
      fallbackGroups.push(group)
    } else {
      liveRows.push(buildLiveRow(group, { station: selectedBusStation, direction: selectedBusDirection }))
    }
  }

  const imminentRows = liveRows.filter((r) => r.sec <= SOON_THRESHOLD_SEC).sort((a, b) => a.sec - b.sec)
  const runningRows = liveRows.filter((r) => r.sec > SOON_THRESHOLD_SEC).sort((a, b) => a.sec - b.sec)

  // 정류장에 설정된 노선 중 오늘 arrivals 응답에 아예 없는(완전 미운행) 노선
  const presentRouteNos = new Set(routeGroups.map((g) => g[0].route_no))
  const configuredRoutes = Object.keys(getPerRouteDisplay(selectedBusStation) ?? {})
  const missingRoutes = configuredRoutes.filter((r) => !presentRouteNos.has(r))

  const hasRunning = runningRows.length > 0 || fallbackGroups.length > 0

  return (
    <div className="space-y-3">
      {imminentRows.length > 0 && (
        <section>
          <h3 className="text-[12px] font-bold text-mute mb-1.5">곧 도착</h3>
          <div className="space-y-2">{imminentRows.map((r) => r.node)}</div>
        </section>
      )}

      {hasRunning && (
        <section>
          <h3 className="text-[12px] font-bold text-mute mb-1.5">운행 중</h3>
          <div className="space-y-2">
            {runningRows.map((r) => r.node)}
            {fallbackGroups.map((group) => (
              <BusFallbackCard
                key={group[0].route_no}
                arrival={group[0]}
                gbisStationId={gbisStationId}
                station={selectedBusStation}
                direction={selectedBusDirection}
              />
            ))}
          </div>
        </section>
      )}

      {missingRoutes.length > 0 && (
        <NotRunningSection
          routeNumbers={missingRoutes}
          gbisStationId={gbisStationId}
          direction={selectedBusDirection}
        />
      )}

      {imminentRows.length === 0 && !hasRunning && missingRoutes.length === 0 && (
        <div className="text-caption text-mute py-6 text-center">
          실시간 정보를 가져오는 중이에요. 잠시 후 다시 확인해 주세요.
        </div>
      )}
    </div>
  )
}

/** 실시간 ETA가 확보된 그룹 하나 → {sec, node(TransitCard)}. */
function buildLiveRow(group, { station, direction }) {
  const a = group[0]
  const a2 = group[1] ?? null
  const sec = arrivalEntryToSeconds(a)
  const sec2 = a2 ? arrivalEntryToSeconds(a2) : null
  const minutes2 = arrivalSecondsToMinutes(sec2)

  const cfg = getRouteDisplayConfig(a.route_no)
  const { title, viaChip } = getRouteTitleAndVia(a.route_no, a.category ?? direction, a.destination)
  const perRoute = getPerRouteDisplay(station)?.[a.route_no]
  const originText = perRoute ? getOriginLabel(station, direction, perRoute.origin) : ''
  const crowdedMeta = a.arrival_type === 'realtime' ? CROWDED_META[a.crowded] : null

  const chips = []
  if (a.arrival_type === 'realtime') chips.push({ label: '실시간', tone: 'realtime' })
  if (crowdedMeta) chips.push({ label: crowdedMeta.label, tone: crowdedMeta.tone })
  if (viaChip) chips.push({ label: viaChip, tone: 'neutral' })

  const imminent = !a.is_tomorrow && sec != null && sec <= SOON_THRESHOLD_SEC
  const etaResult = a.is_tomorrow ? { text: '내일 첫차' } : formatEta(sec)

  return {
    sec: a.is_tomorrow ? Infinity : sec,
    node: (
      <TransitCard
        key={a.route_no}
        badge={{ label: a.route_no, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
        title={title}
        subtitle={originText || undefined}
        chips={chips}
        eta={{
          primary: { text: etaResult.text, tone: imminent ? 'imminent' : 'default' },
          secondary: minutes2 != null ? { text: `다음 ${minutes2}분` } : undefined,
        }}
        onClick={() => navigateToBusRoute(a.route_no, station)}
      />
    ),
  }
}

/**
 * 서울 정류장(시간표 전용) 카드 — useBusTimetable을 노선별로 구독하는 서브컴포넌트.
 * 서울 정류장은 항상 등교 전용·실시간 없음이라 곧 도착/운행 중 구분 없이 한 목록에 둔다.
 */
function SeoulRouteCard({ route, selectedBusStation, selectedBusDirection }) {
  const { route_id, route_number } = route
  const timetable = useBusTimetable(route_id)

  if (timetable.loading) return <SkeletonArrivalCard />
  if (timetable.error && !timetable.data) {
    return <ErrorState message={`${route_number} 정보 오류`} onRetry={timetable.refetch} className="py-4" />
  }

  const entries = extractNext(timetable.data, 2)
  const nextEntry = entries[0] ?? null
  const secondEntry = entries[1] ?? null
  const nextSec = arrivalToSeconds(nextEntry)
  const secondMinutes = arrivalToMinutes(secondEntry)
  const imminent = nextSec != null && nextSec <= SOON_THRESHOLD_SEC

  const perRoute = getPerRouteDisplay(selectedBusStation)?.[route_number]
  const cfg = getRouteDisplayConfig(route_number)
  const { title, viaChip } = getRouteTitleAndVia(route_number, selectedBusDirection, route.direction_name)
  const originText = perRoute ? getOriginLabel(selectedBusStation, selectedBusDirection, perRoute.origin) : ''

  const etaResult = nextSec == null ? { text: '출발 정보 없음', tone: 'muted' } : formatEta(nextSec)

  return (
    <TransitCard
      badge={{ label: route_number, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      subtitle={originText || undefined}
      chips={viaChip ? [{ label: viaChip, tone: 'neutral' }] : []}
      eta={{
        primary: { text: etaResult.text, tone: nextSec == null ? 'muted' : imminent ? 'imminent' : 'default' },
        secondary: secondMinutes != null ? { text: `다음 ${secondMinutes}분` } : undefined,
      }}
      onClick={() => navigateToBusRoute(route_number, selectedBusStation)}
    />
  )
}

/**
 * 결함 #17 — 실시간 도착 데이터는 있지만(arrivals 응답에 항목 존재) 실시간 위치가
 * 아직 안 잡혀 arrive_in_seconds가 없는 노선. "실시간 준비 중" 대신 시간표 폴백:
 * 오늘 남은 시간표가 있으면 그 시각을, 없으면 안내 문구를 보여준다.
 */
function BusFallbackCard({ arrival, gbisStationId, station, direction }) {
  const todayTT = useBusTimetableByRoute(arrival.route_no, { stopId: gbisStationId })
  const cfg = getRouteDisplayConfig(arrival.route_no)
  const { title, viaChip } = getRouteTitleAndVia(
    arrival.route_no,
    arrival.category ?? direction,
    arrival.destination ?? todayTT.data?.direction_name
  )

  const next = nextTimeToday(todayTT.data?.times)
  const chips = [{ label: '실시간 연결 중', tone: 'neutral' }]
  if (viaChip) chips.push({ label: viaChip, tone: 'neutral' })

  return (
    <TransitCard
      badge={{ label: arrival.route_no, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      subtitle={getOriginLabel(station, direction, getPerRouteDisplay(station)?.[arrival.route_no]?.origin) || undefined}
      chips={chips}
      eta={
        next
          ? { primary: { text: `${next} 출발`, tone: 'default' }, secondary: { text: '시간표 기준' } }
          : { primary: { text: '출발 정보 없음', tone: 'muted' }, secondary: { text: '잠시 후 다시 확인' } }
      }
    />
  )
}

/** 결함 #27 — "오늘 미운행 · N" 접힘 섹션. 기본 접힘, 펼치면 노선별 muted 카드. */
function NotRunningSection({ routeNumbers, gbisStationId, direction }) {
  const [open, setOpen] = useState(false)

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[12px] font-bold text-mute mb-1.5 pressable"
      >
        오늘 미운행 · {routeNumbers.length}
        <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-base ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2">
          {routeNumbers.map((routeNo) => (
            <NotRunningCard key={routeNo} routeNo={routeNo} gbisStationId={gbisStationId} direction={direction} />
          ))}
        </div>
      )}
    </section>
  )
}

function NotRunningCard({ routeNo, gbisStationId, direction }) {
  // 평일 시간표를 기준으로 "다음 첫차" 안내(정확한 요일 계산 대신 평일/토/일 스케줄
  // 타입을 그대로 노출 — 백엔드 schedule_type 규약과 일치).
  const weekdayTT = useBusTimetableByRoute(routeNo, { stopId: gbisStationId, scheduleType: 'weekday' })
  const cfg = getRouteDisplayConfig(routeNo)
  const { title } = getRouteTitleAndVia(routeNo, direction, weekdayTT.data?.direction_name)
  const weekdayFirst = nextTimeToday(weekdayTT.data?.times, { anyTime: true })

  return (
    <TransitCard
      badge={{ label: routeNo, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      muted
      chips={[{ label: '오늘 미운행', tone: 'neutral' }]}
      eta={{
        primary: { text: '오늘 미운행', tone: 'muted' },
        secondary: { text: weekdayFirst ? `평일 ${weekdayFirst} 첫차` : '시간표 확인 전' },
      }}
    />
  )
}

/**
 * 시간표 times(문자열 "HH:MM" 배열)에서 다음 출발 시각을 찾는다.
 * anyTime이면 지금 이후 필터 없이 첫 값을 그대로 반환(다른 스케줄 타입의 "첫차" 조회용).
 */
function nextTimeToday(times, { anyTime = false } = {}) {
  if (!Array.isArray(times) || times.length === 0) return null
  const sorted = times.filter((t) => typeof t === 'string').slice().sort()
  if (anyTime) return sorted[0] ?? null
  const now = new Date()
  const upcoming = sorted.filter((t) => {
    const [h, m] = t.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d.getTime() >= now.getTime()
  })
  return upcoming[0] ?? null
}

function extractNext(data, n = 2) {
  if (!data) return []
  if (Array.isArray(data)) return data.slice(0, n)
  if (data.arrivals) return data.arrivals.slice(0, n)
  if (data.times) {
    const now = new Date()
    return data.times
      .filter((t) => {
        if (typeof t !== 'string') return false
        const [h, m] = t.split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return false
        const d = new Date(now); d.setHours(h, m, 0, 0)
        const diff = d.getTime() - now.getTime()
        return diff >= 0 && diff <= 12 * 60 * 60 * 1000
      })
      .slice(0, n)
      .map((t) => ({ depart_at: t }))
  }
  return []
}

function arrivalToSeconds(entry) {
  if (!entry) return null
  if (entry.arrive_in_seconds != null) {
    return Math.max(0, entry.arrive_in_seconds)
  }
  if (entry.depart_at) {
    const [h, m] = entry.depart_at.split(':').map(Number)
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const now = new Date()
      const t = new Date(now)
      t.setHours(h, m, 0, 0)
      const diff = Math.floor((t - now) / 1000)
      return diff >= 0 ? diff : null
    }
  }
  return null
}

function arrivalToMinutes(entry) {
  const sec = arrivalToSeconds(entry)
  return sec == null ? null : Math.max(0, Math.ceil(sec / 60))
}
