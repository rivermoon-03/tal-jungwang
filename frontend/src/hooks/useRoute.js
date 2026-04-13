import { useApi } from './useApi'

/** 학교 셔틀 탑승지 → 정왕역 자동차 이동 시간 (5분 캐시) */
export function useTaxiToStation() {
  return useApi('/route/taxi-to-station', { interval: 300_000 })
}
