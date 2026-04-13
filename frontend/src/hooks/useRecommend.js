import { useApi } from './useApi'

export function useRecommend(lat, lng) {
  const enabled = lat != null && lng != null
  const path = enabled
    ? `/recommend/transport?origin_lat=${lat}&origin_lng=${lng}`
    : null
  return useApi(path, { interval: 60_000, enabled })
}
