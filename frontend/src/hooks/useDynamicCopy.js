/**
 * useDynamicCopy — 동적 카피 생성 훅 (순수 함수형)
 *
 * 입력:
 *   now         — Date 객체
 *   weather     — useWeather() 반환값 (nullable)
 *   nextArrival — { mode: 'subway'|'bus'|'shuttle', minutes: number, route: string } | null
 *
 * 출력:
 *   warn  — { color: 'orange'|'blue'|'gray', text: string } | null
 *   hero  — { big: string, sub: string }
 *
 * 스펙 §2.3 매트릭스 기준
 */
export function useDynamicCopy({ now = new Date(), weather = null, nextArrival = null } = {}) {
  const hour = now.getHours()

  // ── 경고 배너 계산 ────────────────────────────────────────────────────
  let warn = null

  if (weather) {
    const { currentTemp, rainProb, pm10Grade, warning, currentSky } = weather
    const isRaining = currentSky?.includes('비') || currentSky?.includes('rain') || rainProb >= 80

    if (isRaining) {
      warn = { color: 'orange', text: '☔ 비 오는 중 · 우산' }
    } else if (rainProb >= 60 && warning?.type === 'rain') {
      const h = warning.startHour ?? ''
      warn = { color: 'orange', text: `☔ ${h}시부터 비 · 우산 챙기세요` }
    } else if (typeof currentTemp === 'number' && currentTemp <= -5) {
      warn = { color: 'blue', text: `🥶 ${currentTemp}° 한파 · 두껍게` }
    } else if (typeof currentTemp === 'number' && currentTemp >= 32) {
      warn = { color: 'orange', text: `🥵 ${currentTemp}° 폭염 · 그늘로` }
    } else if (pm10Grade === '나쁨' || pm10Grade === '매우나쁨') {
      warn = { color: 'gray', text: '😷 미세먼지 나쁨 · 마스크' }
    }
  }

  // ── 이모지 ───────────────────────────────────────────────────────────
  const mins = nextArrival?.minutes ?? null
  let urgencyEmoji = ''
  if (mins !== null) {
    if (mins <= 3) urgencyEmoji = ' 🏃'
    else if (mins <= 10) urgencyEmoji = ''
    else urgencyEmoji = ''
  }

  const weatherEmoji =
    weather?.currentSky?.includes('비')
      ? ' ☔'
      : typeof weather?.currentTemp === 'number' && weather.currentTemp <= 0
        ? ' 🥶'
        : ''

  // ── 시간대 구분 ──────────────────────────────────────────────────────
  // 07–11 등교 / 11–15 미드데이 / 15–23 하교 / 23–01 막차 / 01–07 첫차
  const isLastTrain = hour >= 23 || hour < 1
  const isFirstTrain = hour >= 1 && hour < 7
  const isCommute = hour >= 7 && hour < 11
  const isMidday = hour >= 11 && hour < 15
  const isGoingHome = hour >= 15 && hour < 23

  // 모드 표시 레이블
  const modeLabel =
    nextArrival?.mode === 'subway'
      ? '지하철'
      : nextArrival?.mode === 'shuttle'
        ? '셔틀'
        : nextArrival?.route ?? '버스'

  let big = '정왕 교통'
  let sub = '다음 출발 정보를 확인하세요'

  if (isFirstTrain) {
    const minsUntil07 = (7 * 60) - (now.getHours() * 60 + now.getMinutes())
    if (hour < 5) {
      big = '🌙 막차 끝났어요'
      sub = '첫차는 07:00부터'
    } else {
      big = '첫차 07:00 · 곧 운행 시작'
      sub =
        minsUntil07 <= 30
          ? '잠시 후 운행이 시작돼요'
          : minsUntil07 <= 90
            ? '한 시간 내로 시작돼요'
            : `07:00까지 ${Math.round(minsUntil07 / 60)}시간 남음`
    }
  } else if (isLastTrain) {
    if (mins !== null) {
      big = `막차 ${mins}분 전 🌙`
      sub = `${modeLabel} · 오늘 마지막 차량`
    } else {
      big = '막차 임박 🌙'
      sub = '막차 시간을 확인하세요'
    }
  } else if (isCommute) {
    // 등교
    if (mins !== null) {
      big = `등교 ${modeLabel} ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
      sub = mins <= 3 ? '지금 바로 출발하세요!' : `${modeLabel}으로 등교`
    } else {
      big = `등교${weatherEmoji}`
      sub = '도착 정보를 확인하세요'
    }
  } else if (isMidday) {
    // 11–15: 현재 조건 기준
    if (mins !== null) {
      big = `${modeLabel} ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
      sub = '정왕 교통 허브'
    } else {
      big = `정왕 교통 허브${weatherEmoji}`
      sub = '다음 출발 정보'
    }
  } else if (isGoingHome) {
    // 하교
    if (mins !== null) {
      big = `하교 ${modeLabel} ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
      sub = mins <= 3 ? '지금 바로 출발하세요!' : `${modeLabel}으로 하교`
    } else {
      big = `하교${weatherEmoji}`
      sub = '도착 정보를 확인하세요'
    }
  }

  return { warn, hero: { big, sub } }
}
