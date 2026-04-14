import { useApi } from './useApi'

/**
 * 날씨 현황 훅
 * GET /api/v1/weather/current — 10분마다 폴링
 *
 * 반환: { weather, loading, error }
 * weather 스키마 (§12.3):
 *   currentTemp, currentSky, icon, rainProb, pm10Grade,
 *   warning: { type, startHour, copy } | null,
 *   nextTemps: [{ hour, temp }],
 *   timeBucket: { label, nextLabel, nextTemp }
 */
export function useWeather() {
  const { data: weather, loading, error, refetch } = useApi('/weather/current', {
    interval: 10 * 60 * 1000, // 10분
  })

  return { weather, loading, error, refetch }
}
