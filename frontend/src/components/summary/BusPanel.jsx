import useAppStore from '../../stores/useAppStore'
import { useMemo } from 'react'
import { useBusRoutesByCategory, useBusArrivals, useBusTimetable } from '../../hooks/useBus'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import ArrivalRow from '../dashboard/ArrivalRow'
import { formatArrival, formatArrivalFromTime } from '../../utils/arrivalTime'
import { getRoutesFor, getGbisStationId } from '../dashboard/busStationConfig'

// 노선 번호별 배지 색상 — 디자인 시스템 단순화까지는 매핑 유지
const ROUTE_INLINE_BG = {
  '20-1':  '#2563EB',
  '5602':  '#2563EB',
  '시흥33': '#0891B2',
  '시흥1':  '#F97316',
  '3400':  '#E02020',
  '6502':  '#E02020',
  '3401':  '#E02020',
}

const DEFAULT_ROUTE_COLOR = '#64748B'

export default function BusPanel() {
  const selectedBusStation   = useAppStore((s) => s.selectedBusStation)
  const selectedBusDirection = useAppStore((s) => s.selectedBusDirection)
  const allowedRouteNumbers  = useMemo(
    () => new Set(getRoutesFor(selectedBusStation, selectedBusDirection)),
    [selectedBusStation, selectedBusDirection]
  )
  const routesQuery = useBusRoutesByCategory(selectedBusDirection)
  const allRoutes   = routesQuery.data ?? []
  const routes      = useMemo(
    () => allRoutes.filter((r) => allowedRouteNumbers.has(r.route_number)),
    [allRoutes, allowedRouteNumbers]
  )

  // 실시간 도착은 선택 정류장의 gbis_station_id가 있을 때만 폴링.
  const gbisStationId   = getGbisStationId(selectedBusStation)
  const hasRealtimeRoute = routes.some((r) => r.is_realtime)
  const realtimeArrivals = useBusArrivals(
    hasRealtimeRoute && gbisStationId ? gbisStationId : null
  )

  return (
    <div className="space-y-2">
      {routesQuery.loading && <Skeleton height="3rem" rounded="rounded-xl" />}
      {routesQuery.error && !routesQuery.loading && (
        <ErrorState message="노선 정보 오류" onRetry={routesQuery.refetch} className="py-4" />
      )}
      {!routesQuery.loading && routes.length === 0 && (
        <div className="text-caption text-mute py-6 text-center">노선이 없습니다</div>
      )}
      {routes.map((route) => (
        <BusRouteRow
          key={route.route_id}
          route={route}
          realtimeArrivals={realtimeArrivals}
        />
      ))}
    </div>
  )
}

function BusRouteRow({ route, realtimeArrivals }) {
  const setDetailModal       = useAppStore((s) => s.setDetailModal)
  const selectedBusDirection = useAppStore((s) => s.selectedBusDirection)
  const { route_id, route_number, is_realtime, stops = [] } = route

  // 실시간: 도착정보 목록에서 이 route_number만 추출 (동일 정류장 여러 노선 중)
  const liveEntries = is_realtime && realtimeArrivals.data?.arrivals
    ? realtimeArrivals.data.arrivals.filter((a) => a.route_no === route_number).slice(0, 2)
    : []
  const hasLiveData = liveEntries.length > 0

  // 비실시간 or 실시간 폴백: route_id 기반 시간표
  const useFallback = !is_realtime || (!realtimeArrivals.loading && !hasLiveData)
  const timetable = useBusTimetable(useFallback ? route_id : null)

  const loading = is_realtime ? realtimeArrivals.loading : timetable.loading
  const refetch = is_realtime
    ? () => { realtimeArrivals.refetch(); timetable.refetch?.() }
    : timetable.refetch

  const hasError = is_realtime
    ? (realtimeArrivals.error && timetable.error && !timetable.data)
    : (timetable.error && !timetable.data)

  if (loading) return <Skeleton height="3rem" rounded="rounded-xl" />
  if (hasError) return <ErrorState message={`${route_number} 정보 오류`} onRetry={refetch} className="py-4" />

  const arrivals = hasLiveData ? liveEntries : extractNext(timetable.data, 2)
  const nextEntry = arrivals[0] ?? null
  const minutes = arrivalToMinutes(nextEntry)

  // 출발지: 이 route의 첫 번째 stop (이미 방향별로 분리된 route라 origin이 명확)
  const originStop = stops[0]
  const originLabel = originStop
    ? (originStop.sub_name ? `${originStop.name} ${originStop.sub_name}` : originStop.name)
    : null
  const destLabel = route.direction_name ?? ''
  const direction = originLabel && destLabel
    ? `${originLabel} 출발 · ${destLabel}`
    : originLabel
      ? `${originLabel} 출발`
      : destLabel
  const stopId = originStop?.stop_id ?? null

  const crowdedLevel = hasLiveData ? (liveEntries[0]?.crowded ?? 0) : 0

  const rightAddon = is_realtime && hasLiveData ? (
    <span className="text-micro font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      테스트-부정확
    </span>
  ) : null

  const handleClick = () => {
    // 현재 페이지 위에 바로 ScheduleDetailModal을 띄운다 (네비게이션 없음).
    setDetailModal({
      type: 'bus',
      routeCode: route_number,
      routeId: route_id ?? null,
      stopId: stopId ?? null,
      favCode: `${selectedBusDirection}:${route_number}`,
      mapLat: originStop?.lat ?? null,
      mapLng: originStop?.lng ?? null,
      isRealtime: !!is_realtime,
      title: route.direction_name
        ? `${route_number} · ${route.direction_name}`
        : `${route_number}번 버스`,
      accentColor: ['3400', '6502', '3401'].includes(route_number) ? '#DC2626' : undefined,
    })
  }

  return (
    <ArrivalRow
      routeColor={ROUTE_INLINE_BG[route_number] ?? DEFAULT_ROUTE_COLOR}
      routeNumber={route_number}
      direction={direction}
      minutes={minutes}
      isUrgent={minutes != null && minutes <= 3}
      onClick={handleClick}
      rightAddon={rightAddon}
      crowded={crowdedLevel}
    />
  )
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
        const d = new Date(now)
        d.setHours(h, m, 0, 0)
        const diff = d.getTime() - now.getTime()
        // 자정 이후 전날 막차 오인 방지: 0 이상 12시간 이내만 포함
        return diff >= 0 && diff <= 12 * 60 * 60 * 1000
      })
      .slice(0, n)
      .map((t) => ({ depart_at: t }))
  }
  return []
}

/**
 * Arrival entry를 "남은 분" 정수로 변환.
 *   - arrive_in_seconds가 있으면 1분 단위 올림
 *   - depart_at("HH:MM")만 있으면 formatArrivalFromTime을 파싱하여 분 추출
 *   - 둘 다 없으면 null → ArrivalRow가 "운행 정보 없음" 표시
 */
function arrivalToMinutes(entry) {
  if (!entry) return null
  if (entry.arrive_in_seconds != null) {
    const label = formatArrival(entry.arrive_in_seconds)
    const m = label && label.match(/^(\d+)/)
    if (m) return Number(m[1])
    return Math.max(0, Math.ceil(entry.arrive_in_seconds / 60))
  }
  if (entry.depart_at) {
    const label = formatArrivalFromTime(entry.depart_at)
    const m = label && label.match(/^(\d+)/)
    if (m) return Number(m[1])
  }
  return null
}
