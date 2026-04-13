import { useApi } from './useApi'

export function useBusStations() {
  return useApi('/bus/stations')
}

export function useBusArrivals(stationId) {
  return useApi(`/bus/arrivals/${stationId}`, {
    interval: 15_000,
    enabled: stationId != null,
  })
}

export function useBusTimetable(routeId) {
  return useApi(`/bus/timetable/${routeId}`, {
    enabled: routeId != null,
  })
}

export function useBusTimetableByRoute(routeNumber) {
  return useApi(`/bus/timetable-by-route/${routeNumber}`, {
    interval: 60_000,
    enabled: routeNumber != null,
  })
}
