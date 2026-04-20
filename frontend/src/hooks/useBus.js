import { useApi } from './useApi'

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
  return { data, loading, error, fetchedAt, refetch }
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
