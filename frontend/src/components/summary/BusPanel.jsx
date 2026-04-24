import useAppStore from '../../stores/useAppStore'
import { useMemo } from 'react'
import { useBusArrivals, useBusRoutesByCategory, useBusTimetable } from '../../hooks/useBus'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import ArrivalRow from '../dashboard/ArrivalRow'
import {
  getGbisStationId, getViaLabel,
  getPerRouteDisplay, getRoutesFor,
  getRouteDisplayConfig,
} from '../dashboard/busStationConfig'

const DEFAULT_ROUTE_COLOR = '#64748B'

export default function BusPanel() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const { direction: selectedBusDirection } = useEffectiveDirection()
  const gbisStationId = getGbisStationId(selectedBusStation)
  const setDetailModal = useAppStore((s) => s.setDetailModal)

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
        {routesQuery.loading && <Skeleton height="3rem" rounded="rounded-xl" />}
        {routesQuery.error && !routesQuery.loading && (
          <ErrorState message="노선 정보 오류" onRetry={routesQuery.refetch} className="py-4" />
        )}
        {!routesQuery.loading && seoulRoutes.length === 0 && (
          <div className="text-caption text-mute py-6 text-center">노선이 없습니다</div>
        )}
        {seoulRoutes.map((route) => (
          <SeoulRouteRow
            key={route.route_id}
            route={route}
            selectedBusStation={selectedBusStation}
            selectedBusDirection={selectedBusDirection}
            setDetailModal={setDetailModal}
          />
        ))}
      </div>
    )
  }

  // gbis 정류장: arrivals 통합 렌더링
  if (arrivalsQuery.loading) return <Skeleton height="3rem" rounded="rounded-xl" />
  if (arrivalsQuery.error && !arrivalsQuery.data) {
    return <ErrorState message="버스 정보 오류" onRetry={arrivalsQuery.refetch} className="py-4" />
  }

  const arrivals = arrivalsQuery.data?.arrivals ?? []
  const now = new Date()

  if (arrivals.length === 0) {
    return <div className="text-caption text-mute py-6 text-center">운행 정보 없음</div>
  }

  // route_no 기준으로 그룹핑 — 같은 노선의 여러 버스를 1행으로 표시
  const routeGroups = []
  const seenRoutes = new Map()
  for (const a of arrivals) {
    if (seenRoutes.has(a.route_no)) {
      seenRoutes.get(a.route_no).push(a)
    } else {
      const group = [a]
      seenRoutes.set(a.route_no, group)
      routeGroups.push(group)
    }
  }

  // 운행 정보가 있는 노선을 먼저, 없는 노선을 뒤로; 동일 그룹 내 도착이 임박한 순
  const groupHasLive = (g) =>
    g.some((a) => a.minutes != null || a.predict_sec != null || a.arrive_in_seconds != null)
  const groupEarliest = (g) => {
    let min = Infinity
    for (const a of g) {
      const m =
        a.minutes != null
          ? a.minutes
          : a.predict_sec != null
          ? Math.floor(a.predict_sec / 60)
          : a.arrive_in_seconds != null
          ? Math.floor(a.arrive_in_seconds / 60)
          : null
      if (m != null && m < min) min = m
    }
    return min === Infinity ? 9999 : min
  }
  routeGroups.sort((a, b) => {
    const aHas = groupHasLive(a)
    const bHas = groupHasLive(b)
    if (aHas !== bHas) return aHas ? -1 : 1
    return groupEarliest(a) - groupEarliest(b)
  })

  return (
    <div className="space-y-2">
      {routeGroups.map((group) => {
        const a = group[0]
        const a2 = group[1] ?? null

        const toMinutes = (entry) => {
          if (!entry) return null
          if (entry.arrival_type === 'timetable') {
            if (!entry.is_tomorrow && entry.depart_at) {
              const [h, m] = entry.depart_at.split(':').map(Number)
              const t = new Date(now); t.setHours(h, m, 0, 0)
              const diffSec = Math.floor((t - now) / 1000)
              return diffSec < 0 ? null : Math.ceil(diffSec / 60)
            }
            return null
          }
          return entry.arrive_in_seconds != null
            ? Math.max(0, Math.ceil(entry.arrive_in_seconds / 60))
            : null
        }

        const minutes = toMinutes(a)
        const minutes2 = toMinutes(a2)

        const perRoute = getPerRouteDisplay(selectedBusStation)?.[a.route_no]
        const cfg = getRouteDisplayConfig(a.route_no)
        const viaLabel = getViaLabel(selectedBusStation, selectedBusDirection)
        const destText = perRoute?.dest ?? cfg?.direction ?? viaLabel ?? (a.destination ?? '')
        const originText = perRoute ? `${perRoute.origin} 출발` : ''
        const routeColor = cfg?.color ?? DEFAULT_ROUTE_COLOR

        const rightAddon = a.arrival_type === 'realtime' ? (
          <span className="text-micro font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
            실시간
          </span>
        ) : null

        return (
          <ArrivalRow
            key={a.route_no}
            routeColor={routeColor}
            routeNumber={a.route_no}
            direction={originText || destText}
            subdirection={originText && destText ? destText : ''}
            minutes={a.is_tomorrow ? '내일 첫차' : minutes}
            extraMinutes={minutes2 != null ? [minutes2] : []}
            isUrgent={typeof minutes === 'number' && minutes <= 3}
            rightAddon={rightAddon}
            crowded={a.arrival_type === 'realtime' ? (a.crowded ?? 0) : 0}
            onClick={() => setDetailModal({
              type: 'bus',
              routeCode: a.route_no,
              routeId: a.route_id ?? null,
              stopId: arrivalsQuery.data?.station_id ?? null,
              favCode: `${selectedBusDirection}:${a.route_no}`,
              mapLat: null,
              mapLng: null,
              isRealtime: a.arrival_type !== 'timetable',
              title: a.destination ? `${a.route_no} · ${a.destination}` : `${a.route_no}번 버스`,
              accentColor: ['3400', '5200', '6502', '3401'].includes(a.route_no) ? '#DC2626' : undefined,
            })}
          />
        )
      })}
    </div>
  )
}

function SeoulRouteRow({ route, selectedBusStation, selectedBusDirection, setDetailModal }) {
  const { route_id, route_number, stops = [] } = route
  const timetable = useBusTimetable(route_id)

  if (timetable.loading) return <Skeleton height="3rem" rounded="rounded-xl" />
  if (timetable.error && !timetable.data) {
    return <ErrorState message={`${route_number} 정보 오류`} onRetry={timetable.refetch} className="py-4" />
  }

  const arrivals = extractNext(timetable.data, 2)
  const nextEntry = arrivals[0] ?? null
  const secondEntry = arrivals[1] ?? null
  const minutes = arrivalToMinutes(nextEntry)
  const secondMinutes = arrivalToMinutes(secondEntry)

  const perRoute = getPerRouteDisplay(selectedBusStation)?.[route_number]
  const cfg = getRouteDisplayConfig(route_number)
  const destText = perRoute?.dest ?? cfg?.direction ?? (route.direction_name ?? '')
  const originText = perRoute ? `${perRoute.origin} 출발` : ''

  return (
    <ArrivalRow
      routeColor={cfg?.color ?? DEFAULT_ROUTE_COLOR}
      routeNumber={route_number}
      direction={originText || destText}
      subdirection={originText && destText ? destText : ''}
      minutes={minutes}
      extraMinutes={secondMinutes != null ? [secondMinutes] : []}
      isUrgent={minutes != null && minutes <= 3}
      onClick={() => setDetailModal({
        type: 'bus',
        routeCode: route_number,
        routeId: route_id ?? null,
        stopId: stops[0]?.stop_id ?? null,
        favCode: `${selectedBusDirection}:${route_number}`,
        mapLat: stops[0]?.lat ?? null,
        mapLng: stops[0]?.lng ?? null,
        isRealtime: false,
        title: route.direction_name
          ? `${route_number} · ${route.direction_name}`
          : `${route_number}번 버스`,
        accentColor: ['3400', '5200', '6502', '3401'].includes(route_number) ? '#DC2626' : undefined,
      })}
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
        const d = new Date(now); d.setHours(h, m, 0, 0)
        const diff = d.getTime() - now.getTime()
        return diff >= 0 && diff <= 12 * 60 * 60 * 1000
      })
      .slice(0, n)
      .map((t) => ({ depart_at: t }))
  }
  return []
}

function arrivalToMinutes(entry) {
  if (!entry) return null
  if (entry.arrive_in_seconds != null) {
    return Math.max(0, Math.ceil(entry.arrive_in_seconds / 60))
  }
  if (entry.depart_at) {
    const [h, m] = entry.depart_at.split(':').map(Number)
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const now = new Date()
      const t = new Date(now)
      t.setHours(h, m, 0, 0)
      const diff = Math.ceil((t - now) / 60000)
      return diff >= 0 ? diff : null
    }
  }
  return null
}
