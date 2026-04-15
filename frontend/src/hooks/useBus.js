import { useApi } from './useApi'

export function useBusStations() {
  return useApi('/bus/stations')
}

export function useBusArrivals(stationId) {
  const { data, loading, error, fetchedAt, refetch } = useApi(`/bus/arrivals/${stationId}`, {
    interval: 30_000,
    enabled: stationId != null,
  })
  return { data, loading, error, fetchedAt, refetch }
}

export function useBusTimetable(routeId) {
  return useApi(`/bus/timetable/${routeId}`, {
    enabled: routeId != null,
  })
}

export function useBusTimetableByRoute(routeNumber, { stopId } = {}) {
  const q = stopId != null ? `?stop_id=${stopId}` : ''
  return useApi(routeNumber != null ? `/bus/timetable-by-route/${routeNumber}${q}` : null, {
    interval: 60_000,
    enabled: routeNumber != null,
  })
}
