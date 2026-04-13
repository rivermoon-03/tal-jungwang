import { useApi } from './useApi'

/**
 * 학교 → 주요 목적지 자동차 소요 시간 목록.
 * 백엔드가 20분 캐시이므로 프론트는 5분마다 폴링.
 */
export function useTaxiDestinations() {
  const { data, loading, error, refetch } = useApi('/route/taxi-destinations', {
    interval: 300_000, // 5분
  })
  return {
    destinations: data?.destinations ?? null,
    loading,
    error,
    refetch,
  }
}
