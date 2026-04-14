import { useMemo } from 'react'
import { useApi } from './useApi'

/**
 * 날씨 현황 훅
 * GET /api/v1/weather/current — 10분마다 폴링
 *
 * 백엔드는 snake_case를 반환하므로 여기서 camelCase로 변환한다.
 * 반환: { weather, loading, error, refetch }
 * weather 스키마 (§12.3):
 *   currentTemp, currentSky, icon, rainProb, pm10Grade,
 *   warning: { type, startHour, copy } | null,
 *   nextTemps: [{ hour, temp }],
 *   timeBucket: { label, nextLabel, nextTemp }
 */
export function useWeather() {
  const { data: raw, loading, error, refetch } = useApi('/weather/current', {
    interval: 10 * 60 * 1000, // 10분
  })

  // snake_case → camelCase 단일 변환 지점
  const weather = useMemo(() => {
    if (!raw) return raw // null/undefined 그대로 전달

    const tb = raw.time_bucket ?? raw.timeBucket ?? null
    const w  = raw.warning ?? null

    return {
      currentTemp: raw.current_temp  ?? raw.currentTemp  ?? null,
      currentSky:  raw.current_sky   ?? raw.currentSky   ?? null,
      icon:        raw.icon          ?? null,
      rainProb:    raw.rain_prob     ?? raw.rainProb      ?? null,
      pm10Grade:   raw.pm10_grade    ?? raw.pm10Grade     ?? null,
      warning: w ? {
        type:      w.type      ?? null,
        startHour: w.start_hour ?? w.startHour ?? null,
        copy:      w.copy      ?? null,
      } : null,
      nextTemps: (raw.next_temps ?? raw.nextTemps ?? []).map((t) => ({
        hour: t.hour ?? null,
        temp: t.temp ?? null,
      })),
      timeBucket: tb ? {
        label:     tb.label      ?? null,
        nextLabel: tb.next_label ?? tb.nextLabel ?? null,
        nextTemp:  tb.next_temp  ?? tb.nextTemp  ?? null,
      } : null,
    }
  }, [raw])

  return { weather, loading, error, refetch }
}
