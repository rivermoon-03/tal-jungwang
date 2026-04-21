// 노선별 24시간 혼잡도 곡선을 가져온다.
// GBIS crowded1/crowded2 (1=여유 … 4=매우혼잡)를 30분 버킷으로 평균.
import { useApi } from './useApi'

// 백엔드 캐시가 30분이라 클라이언트에서는 5분 TTL로 충분 —
// 탭을 왔다갔다 할 때 네트워크 없이 즉시 전환되도록 한다.
const FLOW_TTL = 300_000

export function useCrowdingFlow(routeNumber, dayType = 'weekday') {
  const qs = new URLSearchParams({ day_type: dayType })
  const path = routeNumber
    ? `/bus/crowding/${encodeURIComponent(routeNumber)}?${qs.toString()}`
    : null
  return useApi(path, { enabled: !!routeNumber, ttl: FLOW_TTL })
}
