import { useApi } from './useApi'

// 식단표는 주 단위로 갱신 — 클라 캐시 5분이면 충분(서버는 6시간 TTL).
const TTL = 5 * 60 * 1000

export function useCafeteriaMenu() {
  return useApi('/cafeteria/menu', { ttl: TTL })
}
