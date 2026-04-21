import { useApi } from './useApi'

// 셔틀 시간표는 하루 단위로 정적(서버 Redis TTL 1h)이라 클라이언트에서 공유 캐시.
// 11곳에서 useShuttleSchedule을 호출해도 네트워크 요청은 1회로 합쳐진다.
const SCHEDULE_TTL = 5 * 60 * 1000

// direction: 0=등교, 1=하교 (int) | undefined=전체
// dateStr: 'YYYY-MM-DD' | undefined=오늘
export function useShuttleSchedule(direction, dateStr, opts = {}) {
  const params = []
  if (direction !== undefined && direction !== null) params.push(`direction=${direction}`)
  if (dateStr) params.push(`date=${dateStr}`)
  const q = params.length ? `?${params.join('&')}` : ''
  return useApi(`/shuttle/schedule${q}`, { ttl: SCHEDULE_TTL, ...opts })
}

export function useShuttleNext(direction) {
  const q = direction !== undefined && direction !== null ? `?direction=${direction}` : ''
  return useApi(`/shuttle/next${q}`, { interval: 15_000 })
}
