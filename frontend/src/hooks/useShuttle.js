import { useApi } from './useApi'

// direction: 0=등교, 1=하교 (int) | undefined=전체
export function useShuttleSchedule(direction) {
  const q = direction !== undefined && direction !== null ? `?direction=${direction}` : ''
  return useApi(`/shuttle/schedule${q}`)
}

export function useShuttleNext(direction) {
  const q = direction !== undefined && direction !== null ? `?direction=${direction}` : ''
  return useApi(`/shuttle/next${q}`, { interval: 15_000 })
}
