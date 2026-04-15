/**
 * useDynamicCopy — 상단 Hero 배너 동적 카피 (순수 함수형)
 *
 * 입력:
 *   now         — Date 객체
 *   weather     — useWeather() 반환값 (nullable)
 *   nextArrival — {
 *     mode: 'subway'|'bus'|'shuttle',
 *     minutes: number,
 *     route?: string,
 *     direction?: string,   // 셔틀: '등교'|'하교'
 *     headLabel?: string,   // 지하철: "정왕역 (수인분당선) 인천행"
 *     pillLabel?: string,   // "3400 5분 · 6502 8분"
 *     subLabel?: string,    // 보조 라인
 *   } | null
 *
 * 출력:
 *   warn — { color: 'orange'|'blue'|'gray', text: string } | null
 *   hero — { big: string, sub: string }
 */

// ── 시간대별 인사 풀 ────────────────────────────────────────────────────────
// 각 항목은 [시작시, 끝시(exclusive)] 범위에서 선택. 총 25개 내외.
const GREETINGS = [
  { range: [0, 2],   big: '좋은 밤입니다',         sub: '편안한 밤 되세요' },
  { range: [0, 2],   big: '자정이 지났어요',       sub: '오늘은 여기까지, 푹 쉬세요' },
  { range: [2, 5],   big: '안녕히 주무세요',       sub: '내일 아침에 만나요' },
  { range: [2, 5],   big: '깊은 밤이에요',         sub: '아직 꿈속이라면 더 쉬세요' },
  { range: [5, 7],   big: '고요한 새벽이에요',     sub: '첫차가 곧 움직입니다' },
  { range: [5, 7],   big: '일찍 일어나셨네요',     sub: '조용한 아침 드세요' },
  { range: [7, 9],   big: '좋은 아침입니다',       sub: '오늘도 파이팅!' },
  { range: [7, 9],   big: '상쾌한 아침이에요',     sub: '조심히 등교하세요' },
  { range: [7, 9],   big: '부지런한 하루네요',     sub: '커피 한 잔 어때요' },
  { range: [9, 11],  big: '오전 잘 보내세요',      sub: '집중하기 좋은 시간' },
  { range: [9, 11],  big: '공부도 일도 화이팅',    sub: '점심까지 조금만 힘내요' },
  { range: [11, 13], big: '점심 맛있게 드세요',    sub: '든든하게 챙겨 드셔야 해요' },
  { range: [11, 13], big: '오늘 점심 뭐예요?',     sub: '맛있는 메뉴 고르세요' },
  { range: [13, 15], big: '좋은 오후입니다',       sub: '나른한 오후네요' },
  { range: [13, 15], big: '졸음 조심하세요',       sub: '커피 한 잔이 필요한 시간' },
  { range: [15, 17], big: '오후도 파이팅',         sub: '조금만 더 힘내요' },
  { range: [15, 17], big: '하루가 절반 지났어요',  sub: '퇴근까지 얼마 안 남았어요' },
  { range: [17, 19], big: '퇴근하시나요?',         sub: '오늘 하루 수고하셨어요' },
  { range: [17, 19], big: '하교길 조심히',         sub: '집까지 안전하게' },
  { range: [19, 21], big: '저녁 맛있게 드세요',    sub: '하루 마무리 잘 하세요' },
  { range: [19, 21], big: '오늘 하루 어땠어요?',   sub: '이제 집에 갈 시간' },
  { range: [21, 23], big: '집에 잘 들어가세요',    sub: '따뜻한 저녁 보내세요' },
  { range: [21, 23], big: '오늘도 수고 많았어요',  sub: '푹 쉬세요' },
  { range: [23, 24], big: '좋은 밤입니다',         sub: '막차 시간 꼭 확인하세요' },
  { range: [23, 24], big: '하루가 금방 가네요',    sub: '오늘 하루 수고했어요' },
]

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d - start) / 86400000)
}

function pickGreeting(now) {
  const h = now.getHours()
  const pool = GREETINGS.filter(({ range }) => h >= range[0] && h < range[1])
  if (!pool.length) return { big: '정왕 교통', sub: '다음 출발 정보를 확인하세요' }
  const idx = (dayOfYear(now) * 7 + h * 3 + now.getDate()) % pool.length
  return pool[idx]
}

// ── 경고 배너 ──────────────────────────────────────────────────────────────
function computeWarn(weather) {
  if (!weather) return null
  const { currentTemp, rainProb, pm10Grade, warning, currentSky } = weather
  const isRaining = currentSky?.includes('비') || currentSky?.includes('rain') || rainProb >= 80

  if (isRaining) return { color: 'orange', text: '☔ 비 오는 중 · 우산' }
  if (rainProb >= 60 && warning?.type === 'rain') {
    const h = warning.startHour ?? ''
    return { color: 'orange', text: `☔ ${h}시부터 비 · 우산 챙기세요` }
  }
  if (typeof currentTemp === 'number' && currentTemp <= -5) {
    return { color: 'blue', text: `🥶 ${currentTemp}° 한파 · 두껍게` }
  }
  if (typeof currentTemp === 'number' && currentTemp >= 32) {
    return { color: 'orange', text: `🥵 ${currentTemp}° 폭염 · 그늘로` }
  }
  if (pm10Grade === '나쁨' || pm10Grade === '매우나쁨') {
    return { color: 'gray', text: '😷 미세먼지 나쁨 · 마스크' }
  }
  return null
}

// ── 모드별 big/sub 생성 ────────────────────────────────────────────────────
function buildArrivalCopy(nextArrival, weather, now) {
  const mins = nextArrival.minutes
  const urgencyEmoji = mins != null && mins <= 3 ? ' 🏃' : ''
  const weatherEmoji =
    weather?.currentSky?.includes('비')
      ? ' ☔'
      : typeof weather?.currentTemp === 'number' && weather.currentTemp <= 0
        ? ' 🥶'
        : ''

  const greeting = pickGreeting(now)

  // ── 지하철 ─────────────────────────────────────────
  if (nextArrival.mode === 'subway') {
    const detail = nextArrival.headLabel ?? nextArrival.subLabel ?? ''
    if (mins <= 3 && detail) {
      // 임박 시 "지하철 N분 뒤 🏃" + "정왕역 (수인분당선) 인천행 · 지금 출발!"
      const big = `지하철 ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
      return { big, sub: `${detail} · 지금 출발!` }
    }
    const big = `지하철 ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
    return { big, sub: detail || greeting.sub }
  }

  // ── 셔틀 ───────────────────────────────────────────
  if (nextArrival.mode === 'shuttle') {
    // 방향 우선순위: nextArrival.direction(등교/하교) → 시간대 추정
    const timeDir =
      now.getHours() >= 3 && now.getHours() < 13 ? '등교' : '하교'
    const dir = nextArrival.direction ?? timeDir
    const big = `${dir} 셔틀 ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
    // sub: pillLabel(양방향 시간 모두)에서 big과 겹치지 않는 추가 정보
    const pill = nextArrival.pillLabel ?? ''
    const sub =
      mins <= 3
        ? '지금 바로 출발하세요!'
        : pill && !pill.startsWith(`${dir} 셔틀 ${mins}분`)
          ? pill
          : (nextArrival.subLabel ?? greeting.sub)
    return { big, sub }
  }

  // ── 버스 ───────────────────────────────────────────
  const route = nextArrival.route ?? '버스'
  const big = `${route} ${mins}분 뒤${urgencyEmoji}${weatherEmoji}`
  const pill = nextArrival.pillLabel ?? ''
  // pill이 "route Nmin"만 포함하면 big과 중복 → 인사말 sub로 폴백
  const pillIsRedundant =
    !pill ||
    pill === `${route} ${mins}분` ||
    pill === big.replace(/[🏃☔🥶]/g, '').trim()
  const sub =
    mins <= 3
      ? '지금 바로 출발하세요!'
      : pillIsRedundant
        ? greeting.sub
        : pill
  return { big, sub }
}

// ── 메인 훅 ────────────────────────────────────────────────────────────────
export function useDynamicCopy({ now = new Date(), weather = null, nextArrival = null } = {}) {
  const warn = computeWarn(weather)
  const hour = now.getHours()
  const mins = nextArrival?.minutes ?? null

  // 첫차 전 (01–07) · 막차 직전 (23–01) 전용 메시지
  const isFirstTrain = hour >= 1 && hour < 7
  const isLastTrain = hour >= 23 || hour < 1

  if (isFirstTrain) {
    if (hour < 5) {
      return { warn, hero: { big: '🌙 막차 끝났어요', sub: '첫차는 07:00부터' } }
    }
    const minsUntil07 = (7 * 60) - (now.getHours() * 60 + now.getMinutes())
    return {
      warn,
      hero: {
        big: '첫차 07:00 · 곧 운행 시작',
        sub:
          minsUntil07 <= 30
            ? '잠시 후 운행이 시작돼요'
            : minsUntil07 <= 90
              ? '한 시간 내로 시작돼요'
              : `07:00까지 ${Math.round(minsUntil07 / 60)}시간 남음`,
      },
    }
  }

  if (isLastTrain && mins != null) {
    return {
      warn,
      hero: {
        big: `막차 ${mins}분 전 🌙`,
        sub: nextArrival?.headLabel ?? nextArrival?.subLabel ?? '오늘 마지막 차량',
      },
    }
  }

  // 도착 정보 있음 → 모드별 카피
  if (mins != null && nextArrival) {
    return { warn, hero: buildArrivalCopy(nextArrival, weather, now) }
  }

  // 도착 정보 없음 → 시간대별 인사
  const greeting = pickGreeting(now)
  const weatherEmoji =
    weather?.currentSky?.includes('비')
      ? ' ☔'
      : typeof weather?.currentTemp === 'number' && weather.currentTemp <= 0
        ? ' 🥶'
        : ''
  return { warn, hero: { big: `${greeting.big}${weatherEmoji}`, sub: greeting.sub } }
}
