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
