import useAppStore from '../../stores/useAppStore'
import { useMemo } from 'react'
import { useBusArrivals, useBusRoutesByCategory, useBusTimetable } from '../../hooks/useBus'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { SkeletonArrivalCard } from '../common/Skeleton'
import ErrorState from '../ui/ErrorState'
import ArrivalRow from '../dashboard/ArrivalRow'
import DataBadge from '../ui/DataBadge'
import {
  getGbisStationId,
  getPerRouteDisplay, getRoutesFor,
  getRouteDisplayConfig, getOriginLabel,
  getAllowedDirections,
} from '../dashboard/busStationConfig'
import { IMMINENT_THRESHOLD_SEC } from '../../utils/arrivalTime'
import { groupArrivalsByRoute, buildBusArrivalRow } from '../../utils/busArrivalRows'

const DEFAULT_ROUTE_COLOR = '#64748B'

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
        {seoulRoutes.map((route) => (
          <SeoulRouteRow
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
  const now = new Date()

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

  return (
    <div className="space-y-2">
      {routeGroups.map((group) => {
        const row = buildBusArrivalRow(group, {
          station: selectedBusStation,
          direction: selectedBusDirection,
          now,
        })
        const rightAddon = row.isRealtime ? <DataBadge state="live" /> : null

        return (
          <ArrivalRow
            key={row.routeNo}
            routeColor={row.routeColor}
            routeNumber={row.routeNo}
            direction={row.direction}
            subdirection={row.subdirection}
            minutes={row.minutes}
            extraMinutes={row.minutes2 != null ? [row.minutes2] : []}
            imminentLabel={row.imminent ? '곧 도착' : null}
            isUrgent={row.imminent || (typeof row.minutes === 'number' && row.minutes <= 3)}
            isRealtime={row.isRealtime}
            rightAddon={rightAddon}
            crowded={row.crowded}
            selectedStation={selectedBusStation}
          />
        )
      })}
    </div>
  )
}

function SeoulRouteRow({ route, selectedBusStation, selectedBusDirection }) {
  const { route_id, route_number, stops = [] } = route
  const timetable = useBusTimetable(route_id)

  if (timetable.loading) return <SkeletonArrivalCard />
  if (timetable.error && !timetable.data) {
    return <ErrorState message={`${route_number} 정보 오류`} onRetry={timetable.refetch} className="py-4" />
  }

  const arrivals = extractNext(timetable.data, 2)
  const nextEntry = arrivals[0] ?? null
  const secondEntry = arrivals[1] ?? null
  const minutes = arrivalToMinutes(nextEntry)
  const secondMinutes = arrivalToMinutes(secondEntry)
  const nextSec = arrivalToSeconds(nextEntry)
  const imminent = nextSec != null && nextSec < IMMINENT_THRESHOLD_SEC

  const perRoute = getPerRouteDisplay(selectedBusStation)?.[route_number]
  const cfg = getRouteDisplayConfig(route_number)
  const destText = perRoute?.dest ?? cfg?.direction ?? (route.direction_name ?? '')
  const originText = perRoute
    ? getOriginLabel(selectedBusStation, selectedBusDirection, perRoute.origin)
    : ''

  return (
    <ArrivalRow
      routeColor={cfg?.color ?? DEFAULT_ROUTE_COLOR}
      routeNumber={route_number}
      direction={originText || destText}
      subdirection={originText && destText ? destText : ''}
      minutes={minutes}
      extraMinutes={secondMinutes != null ? [secondMinutes] : []}
      imminentLabel={imminent ? '곧 도착' : null}
      isUrgent={imminent || (minutes != null && minutes <= 3)}
      selectedStation={selectedBusStation}
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
