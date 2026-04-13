import { useApi } from './useApi'

export function useSubwayTimetable(direction) {
  const q = direction ? `?direction=${direction}` : ''
  return useApi(`/subway/timetable${q}`)
}

export function useSubwayNext() {
  return useApi('/subway/next', { interval: 30_000 })
}
