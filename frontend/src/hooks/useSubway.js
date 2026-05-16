import { useMemo } from 'react'
import { useApi } from './useApi'
import { useNow } from './useNow'
import { tickSubwayNext, tickSubwayRealtime } from '../utils/tickArrivals'

export function useSubwayTimetable(direction) {
  const q = direction ? `?direction=${direction}` : ''
  return useApi(`/subway/timetable${q}`)
}

export function useSubwayNext() {
  const { data, loading, error, fetchedAt, refetch } = useApi('/subway/next', { interval: 30_000 })
  const now = useNow(1000)
  const ticked = useMemo(
    () => tickSubwayNext(data, fetchedAt, now),
    [data, fetchedAt, now]
  )
  return { data: ticked, loading, error, fetchedAt, refetch }
}

export function useSubwayRealtime() {
  const { data, loading, error, fetchedAt, refetch } = useApi('/subway/realtime', { interval: 10_000 })
  const now = useNow(1000)
  const ticked = useMemo(
    () => tickSubwayRealtime(data, fetchedAt, now),
    [data, fetchedAt, now]
  )
  return { data: ticked, loading, error, fetchedAt, refetch }
}

/**
 * 실시간 응답을 envelope({items, stale, last_successful_realtime_at})
 * 또는 레거시 배열 둘 다에서 받아, 일관된 형태로 정규화.
 *
 * @param {object|array|null} stationPayload
 * @returns {{items: array, stale: boolean, lastSuccessfulRealtimeAt: string|null}}
 */
export function normalizeRealtimeStation(stationPayload) {
  if (!stationPayload) {
    return { items: [], stale: false, lastSuccessfulRealtimeAt: null }
  }
  if (Array.isArray(stationPayload)) {
    return { items: stationPayload, stale: false, lastSuccessfulRealtimeAt: null }
  }
  return {
    items: Array.isArray(stationPayload.items) ? stationPayload.items : [],
    stale: Boolean(stationPayload.stale),
    lastSuccessfulRealtimeAt: stationPayload.last_successful_realtime_at ?? null,
  }
}
