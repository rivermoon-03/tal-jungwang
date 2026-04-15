import { useApi } from './useApi'

// 마커는 거의 변하지 않음 — SW StaleWhileRevalidate + 백엔드 Redis 24h 캐시.
// 훅에서는 별도 polling 없음. 앱 재기동 시 한 번만 fetch.
export function useMapMarkers() {
  return useApi('/map/markers')
}
