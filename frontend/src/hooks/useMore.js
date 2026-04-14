import { useApi } from './useApi'

export function useNotices() {
  return useApi('/more/notices', { interval: 300_000 })
}

export function useLinks() {
  return useApi('/more/links', { interval: 3_600_000 })
}

export function useAppInfo() {
  return useApi('/more/info', { interval: 3_600_000 })
}
