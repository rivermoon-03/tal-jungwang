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
    interval: 60_000,
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

export function useBusHistoryPreview(routeNumber) {
  return useApi(routeNumber ? `/bus/history-preview/${routeNumber}` : null, {
    enabled: routeNumber != null,
  })
}
