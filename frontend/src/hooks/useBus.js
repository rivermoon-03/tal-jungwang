import { useMemo } from 'react'
import { useApi } from './useApi'
import { useNow } from './useNow'
import { tickBusArrivals } from '../utils/tickArrivals'

export function useBusStations() {
  return useApi('/bus/stations')
}

export function useBusRoutesByCategory(category) {
  const q = category ? `?category=${encodeURIComponent(category)}` : ''
  return useApi(`/bus/routes${q}`, { enabled: category != null })
}

export function useBusArrivals(stationId) {
  const { data, loading, error, fetchedAt, refetch } = useApi(`/bus/arrivals/${stationId}`, {
    // 백엔드 GBIS 폴링은 45s 주기 — refetch 30s는 캐시 hit으로 GBIS 호출량은 늘리지
    // 않으면서 stale gap을 60s → 30s로 절반.
    interval: 30_000,
    enabled: stationId != null,
  })
  // 백엔드가 응답 시점 기준으로 arrive_in_seconds를 보정해 주지만,
  // 다음 refetch(최대 60초)까지 값이 정지해 있어 "4분"이 그대로 고정된다.
  // 1초 tick으로 fetchedAt 경과만큼 realtime 값을 깎아 화면이 실제 시간과 함께 흐르게 한다.
  const now = useNow(1000)
  const ticked = useMemo(
    () => tickBusArrivals(data, fetchedAt, now),
    [data, fetchedAt, now]
  )
  return { data: ticked, loading, error, fetchedAt, refetch }
}

export function useBusTimetable(routeId) {
  return useApi(`/bus/timetable/${routeId}`, {
    enabled: routeId != null,
  })
}

export function useBusTimetableByRoute(routeNumber, { stopId, requireStopId = false } = {}) {
  const q = stopId != null ? `?stop_id=${stopId}` : ''
  const ready = routeNumber != null && (!requireStopId || stopId != null)
  return useApi(ready ? `/bus/timetable-by-route/${routeNumber}${q}` : null, {
    enabled: ready,
  })
}

export function useBusHistoryPreview(routeNumber, stopId = null) {
  // realtime_eta가 응답에 포함되므로 30초 폴링으로 카운트다운 흐름 유지.
  // (useBusArrivals와 같은 30초 주기 — 백엔드 GBIS 폴링은 45초이므로 캐시 hit.)
  //
  // stopId: 카드와 동일한 정류장(GBIS 추적 정류장)을 명시해 realtime_eta가 같은 stop을 보게 한다.
  // 미전달 시 backend가 bus_arrival_history 빈도로 추정하지만, 그 stop은 카드와 다를 수 있다.
  const q = stopId != null ? `?stop_id=${encodeURIComponent(stopId)}` : ''
  return useApi(routeNumber ? `/bus/history-preview/${routeNumber}${q}` : null, {
    enabled: routeNumber != null,
    interval: 30_000,
  })
}

export function useBusArrivalStats(routeId, stopId) {
  const ready = routeId != null && stopId != null
  return useApi(ready ? `/bus/arrival-stats/${routeId}/${stopId}` : null, {
    enabled: ready,
    ttl: 5 * 60_000,
  })
}
