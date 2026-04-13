import { useApi } from './useApi'

export function useShuttleSchedule(direction) {
  const q = direction ? `?direction=${encodeURIComponent(direction)}` : ''
  return useApi(`/shuttle/schedule${q}`)
}

export function useShuttleNext(direction) {
  const q = direction ? `?direction=${encodeURIComponent(direction)}` : ''
  return useApi(`/shuttle/next${q}`, { interval: 15_000 })
}
