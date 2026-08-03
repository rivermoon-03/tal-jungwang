import { useMemo } from 'react'
import { useApi } from './useApi'

/**
 * 날씨 현황 훅
 * GET /api/v1/weather/current — 10분마다 폴링
 *
 * 백엔드는 snake_case를 반환하므로 여기서 camelCase로 변환한다.
 * 반환: { weather, loading, error, refetch }
 * weather 스키마 (§12.3):
 *   currentTemp, currentSky, icon, rainProb, windSpeed, pm10Grade,
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
      windSpeed:   raw.wind_speed    ?? raw.windSpeed     ?? null,
      pm10Grade:   raw.pm10_grade    ?? raw.pm10Grade     ?? null,
      // F5 — 에어코리아 실측 + 이동 지수(없으면 null: 프런트는 조용히 숨김)
      pm25Grade:   raw.pm25_grade    ?? raw.pm25Grade     ?? null,
      pm10:        raw.pm10          ?? null,
      pm25:        raw.pm25          ?? null,
      walkIndex:   raw.walk_index
        ? {
            level: raw.walk_index.level,
            label: raw.walk_index.label,
            reason: raw.walk_index.reason,
            // 항목별 근거(기온·강수확률·미세먼지·낙뢰). 구버전 응답이면 빈 배열이라
            // 칩은 그대로 뜨고 팝오버에 판정 문구만 남는다.
            factors: raw.walk_index.factors ?? [],
            // 판정 출처("14:30 발표 초단기예보 기준" 등). 없으면 출처 줄 자체를 숨긴다.
            sourceLabel: raw.walk_index.source_label ?? raw.walk_index.sourceLabel ?? null,
          }
        : null,
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
