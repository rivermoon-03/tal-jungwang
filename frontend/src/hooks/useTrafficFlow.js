// frontend/src/hooks/useTrafficFlow.js
import { useApi } from './useApi'

// 백엔드가 30분 캐시를 쓰므로 클라 TTL 5분이면 방향 전환 시 즉시 반응.
const FLOW_TTL = 300_000

export function useTrafficFlow(dayType = 'weekday', direction = null) {
  const qs = new URLSearchParams({ day_type: dayType })
  if (direction) qs.set('direction', direction)
  return useApi(`/traffic/flow?${qs.toString()}`, { ttl: FLOW_TTL })
}
