/**
 * heroGreeting.js — 홈 히어로 "감성 인사" 글귀 선택 유틸.
 *
 * 시간대(낮/저녁/밤/새벽/심야) · 날씨(맑음/흐림/비/눈) · 날짜(월/계절/특정일) ·
 * 풍속 · 기온 맥락에 맞는 글귀(저작권 만료 한국 근대 시 인용 + 자체 카피)를
 * 하루 단위로 안정적으로 고른다.
 *
 * CLAUDE.md 규칙:
 *  - 시각은 항상 KST tz-aware하게 구한다. `new Date().getHours()` /
 *    `getMonth()` 같은 브라우저 로컬시각 직접 사용 금지(mistakes.md #1).
 *    월·일·요일은 `timeOfDay.js`와 동일하게
 *    `Intl.DateTimeFormat({ timeZone: 'Asia/Seoul' })` 패턴으로 구한다.
 *  - 표시 로직(글귀 선택 규칙)은 이 한 곳에 모아 컴포넌트는 결과만 소비한다
 *    (mistakes.md #2).
 *
 * 선택 우선순위(내림차순):
 *   1. 특정일(월·일 일치)
 *   2. 강풍(windSpeed >= 6, 정왕풍 기준)
 *   3. 혹서(temp >= 32) / 혹한(temp <= -5)
 *   4. mood + 시간대 정확 일치(시간대만 지정된 글귀는 mood를 가리지 않는
 *      와일드카드로 취급 — 새벽/저녁/심야 자체 카피가 여기 해당)
 *   5. mood만 일치(시간대 무관)
 *   6. 계절/월 범위 일치(일부 항목은 mood·시간대 부가 조건을 함께 요구)
 *   7. 범용 폴백(무조건 매치 — 위 어느 것도 안 걸렸을 때의 안전망)
 *
 * 같은 우선순위 안에 후보가 여럿이면 KST 기준 day-of-year를 후보 수로
 *나눈 나머지로 골라, 하루 동안은 고정되고 날짜가 바뀌면 로테이션된다.
 */

import { getKstHour } from './timeOfDay'

const KST_TZ = 'Asia/Seoul'

/**
 * 주어진 Date를 KST 기준 { year, month, day }로 변환한다.
 * `academicCalendar.js`의 `todayKstDateString`과 동일하게 'en-CA' 로케일이
 * 'YYYY-MM-DD' 순서로 포맷해 주는 것을 이용한다.
 * @param {Date} now
 */
function getKstYmd(now) {
  const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: KST_TZ }).format(now)
  const [year, month, day] = formatted.split('-').map(Number)
  return { year, month, day }
}

/** KST 기준 월(1~12). @param {Date} now */
export function getKstMonth(now = new Date()) {
  return getKstYmd(now).month
}

/** KST 기준 일(1~31). @param {Date} now */
export function getKstDate(now = new Date()) {
  return getKstYmd(now).day
}

/**
 * KST 기준 연중 일수(1~366). 같은 날 여러 번 호출해도 동일한 값을 반환해
 * 글귀 로테이션의 안정적인 시드로 쓴다.
 * @param {Date} now
 */
export function getKstDayOfYear(now = new Date()) {
  const { year, month, day } = getKstYmd(now)
  const startOfYear = Date.UTC(year, 0, 1)
  const current = Date.UTC(year, month - 1, day)
  return Math.round((current - startOfYear) / 86_400_000) + 1
}

/**
 * KST 기준 세분화 시간대.
 *   심야 00~04 / 새벽 04~06 / 낮 06~17 / 저녁 17~20 / 밤 20~24
 * `getTimeOfDay`(낮/저녁/밤 3분류)보다 세밀하게, 밤을 심야/새벽으로 쪼갠다.
 * @param {Date} now
 * @returns {'midnight'|'dawn'|'day'|'evening'|'night'}
 */
export function getFineTimeOfDay(now = new Date()) {
  const hour = getKstHour(now)
  if (hour < 4) return 'midnight'
  if (hour < 6) return 'dawn'
  if (hour < 17) return 'day'
  if (hour < 20) return 'evening'
  return 'night'
}

/**
 * 글귀 풀. tier는 위 선택 우선순위(1~7)를 그대로 나타낸다.
 * source가 있으면 인용구(저작권 만료 검증 완료 목록), 없으면 자체 카피다.
 *
 * @typedef {Object} HeroGreeting
 * @property {number} tier
 * @property {string} text
 * @property {string|null} source
 * @property {string|null} sub - source가 없을 때만 쓰는 실용 부제
 * @property {'sunny'|'cloudy'|'rainy'|'snowy'|('sunny'|'cloudy'|'rainy'|'snowy')[]|null} [mood] -
 *   null이면 mood 무관, 배열이면 그중 하나만 일치해도 된다("맑음 또는 흐림" 같은 조건)
 * @property {'midnight'|'dawn'|'day'|'evening'|'night'|('midnight'|'dawn'|'day'|'evening'|'night')[]} [timeOfDay] -
 *   배열이면 그중 하나만 일치해도 된다("새벽 또는 심야" 같은 조건)
 * @property {[number, number]} [hourRange] - [시작시(포함), 끝시(미포함)] KST 시(hour) 범위.
 *   `timeOfDay`(고정 밴드)보다 더 좁은 구간이 필요할 때 tier 4에서 함께 검사한다.
 * @property {{month: number, day: number}} [monthDay]
 * @property {number[]} [months]
 * @property {('midnight'|'dawn'|'day'|'evening'|'night')[]} [timeBand]
 * @property {boolean} [wind]
 * @property {boolean} [heat]
 * @property {boolean} [cold]
 */

/** @type {HeroGreeting[]} */
export const HERO_GREETINGS = [
  // ── tier 1: 특정일 ─────────────────────────────────────────
  {
    tier: 1,
    text: '그날이 오면,\n그날이 오면은',
    source: '심훈, 그날이 오면',
    sub: null,
    monthDay: { month: 8, day: 15 },
  },

  // ── tier 2: 강풍(정왕풍) ───────────────────────────────────
  {
    tier: 2,
    text: '잎새에 이는 바람에도\n나는 괴로워했다',
    source: '윤동주, 서시',
    sub: null,
    wind: true,
  },

  // ── tier 3: 혹서/혹한 ──────────────────────────────────────
  {
    tier: 3,
    text: '한낮이 뜨거워요.\n그늘로 걸어요.',
    source: null,
    sub: '물 챙기기',
    heat: true,
  },
  {
    tier: 3,
    text: '칼바람이에요.\n목도리 단단히.',
    source: null,
    sub: '빙판 조심',
    cold: true,
  },
  {
    tier: 3,
    text: '겨울은 강철로 된\n무지갠가 보다',
    source: '이육사, 절정',
    sub: null,
    cold: true,
  },

  // ── tier 4: mood + 시간대 정확 일치 ────────────────────────
  {
    tier: 4,
    text: '비가 온다, 오누나\n오는 비는 올지라도 한 닷새 왔으면 좋지',
    source: '김소월, 왕십리',
    sub: null,
    mood: 'rainy',
    timeOfDay: 'day',
  },
  {
    tier: 4,
    text: '창밖에 밤비가 속살거려',
    source: '윤동주, 쉽게 씌어진 시',
    sub: null,
    mood: 'rainy',
    timeOfDay: 'night',
  },
  {
    tier: 4,
    text: '돌담에 속삭이는 햇발같이\n풀 아래 웃음 짓는 샘물같이',
    source: '김영랑, 돌담에 속삭이는 햇발',
    sub: null,
    mood: 'sunny',
    timeOfDay: 'day',
  },
  {
    tier: 4,
    text: '뜰에는 반짝이는\n금모래빛',
    source: '김소월, 엄마야 누나야',
    sub: null,
    mood: 'sunny',
    timeOfDay: 'day',
  },
  {
    tier: 4,
    text: '별 하나에 추억과\n별 하나에 사랑과',
    source: '윤동주, 별 헤는 밤',
    sub: null,
    mood: 'sunny',
    timeOfDay: 'night',
  },
  {
    tier: 4,
    text: '달은 지금 긴 산허리에\n걸려 있다',
    source: '이효석, 메밀꽃 필 무렵',
    sub: null,
    mood: 'sunny',
    timeOfDay: 'night',
  },
  {
    tier: 4,
    text: '작은 것이 높이 떠서\n만물을 다 비추니',
    source: '윤선도, 오우가',
    sub: null,
    mood: 'sunny',
    timeOfDay: 'night',
  },
  {
    tier: 4,
    text: '봄 가을 없이 밤마다 돋는 달도\n예전엔 미처 몰랐어요',
    source: '김소월, 예전엔 미처 몰랐어요',
    sub: null,
    mood: ['sunny', 'cloudy'],
    timeOfDay: 'night',
  },
  {
    tier: 4,
    text: '흐리지만\n비 소식은 없어요.',
    source: null,
    sub: null,
    mood: 'cloudy',
    timeOfDay: 'day',
  },
  {
    tier: 4,
    text: '나 두 야 간다\n나 두 야 가련다',
    source: '박용철, 떠나가는 배',
    sub: null,
    mood: null,
    timeOfDay: 'evening',
  },
  {
    tier: 4,
    text: '옛이야기 지줄대는 실개천이\n휘돌아 나가고',
    source: '정지용, 향수',
    sub: null,
    mood: null,
    timeOfDay: 'evening',
  },
  {
    tier: 4,
    text: '보고 싶은 마음\n호수만 하니 눈감을밖에',
    source: '정지용, 호수',
    sub: null,
    mood: null,
    timeOfDay: 'evening',
  },
  {
    tier: 4,
    text: '첫차가 곧 깨어나요.',
    source: null,
    sub: '오늘도 무사히, 등교',
    mood: null,
    timeOfDay: 'dawn',
  },
  {
    tier: 4,
    text: '거울속에는소리가없소',
    source: '이상, 거울',
    sub: null,
    mood: null,
    timeOfDay: 'midnight',
  },
  {
    tier: 4,
    text: '그믐달은 요염하여\n감히 손을 댈 수도 없다',
    source: '나도향, 그믐달',
    sub: null,
    mood: null,
    timeOfDay: ['dawn', 'midnight'],
  },
  {
    tier: 4,
    text: '날자, 날자\n한 번만 더 날자꾸나',
    source: '이상, 날개',
    sub: null,
    mood: null,
    hourRange: [6, 9],
  },

  // ── tier 5: mood만 일치(시간대 무관) ────────────────────────
  {
    tier: 5,
    text: '지금 눈 내리고\n매화 향기 홀로 아득하니',
    source: '이육사, 광야',
    sub: null,
    mood: 'snowy',
  },
  {
    tier: 5,
    text: '추워한다고\n덮어 주는 이불인가 봐',
    source: '윤동주, 눈',
    sub: null,
    mood: 'snowy',
  },
  {
    tier: 5,
    text: '달이 밝고 구름이 흐르고\n하늘이 펼치고',
    source: '윤동주, 자화상',
    sub: null,
    mood: 'cloudy',
  },
  {
    tier: 5,
    text: '얼다가 만 비가\n추적추적 내리었다',
    source: '현진건, 운수 좋은 날',
    sub: null,
    mood: 'rainy',
  },
  {
    tier: 5,
    text: '비가 와요.\n5분 일찍 나서요.',
    source: null,
    sub: '우산 챙기기',
    mood: 'rainy',
  },
  {
    tier: 5,
    text: '볕이 좋아요.\n걸어가도 기분 좋은 날.',
    source: null,
    sub: null,
    mood: 'sunny',
  },

  // ── tier 6: 계절/월 범위 일치 ────────────────────────────────
  {
    tier: 6,
    text: '산에는 꽃 피네, 꽃이 피네\n갈 봄 여름 없이 꽃이 피네',
    source: '김소월, 산유화',
    sub: null,
    months: [3, 4, 5],
  },
  {
    tier: 6,
    text: '고운 봄의 향기가 어리우도다',
    source: '이장희, 봄은 고양이로다',
    sub: null,
    months: [3, 4],
    mood: 'sunny',
  },
  {
    tier: 6,
    text: '강호에 봄이 드니\n미친 흥이 절로 난다',
    source: '맹사성, 강호사시가',
    sub: null,
    months: [3, 4, 5],
  },
  {
    tier: 6,
    text: '빼앗긴 들에도\n봄은 오는가',
    source: '이상화, 빼앗긴 들에도 봄은 오는가',
    sub: null,
    months: [3, 4, 5],
  },
  {
    tier: 6,
    text: '이화에 월백하고\n은한이 삼경인 제',
    source: '이조년, 시조',
    sub: null,
    months: [4],
    timeBand: ['night', 'midnight'],
  },
  {
    tier: 6,
    text: '나는 아직 나의 봄을\n기다리고 있을 테요',
    source: '김영랑, 모란이 피기까지는',
    sub: null,
    months: [5],
  },
  {
    tier: 6,
    text: '내 고장 칠월은\n청포도가 익어 가는 시절',
    source: '이육사, 청포도',
    sub: null,
    months: [7],
  },
  {
    tier: 6,
    text: '계절이 지나가는 하늘에는\n가을로 가득 차 있습니다',
    source: '윤동주, 별 헤는 밤',
    sub: null,
    months: [9, 10, 11],
  },
  {
    tier: 6,
    text: '고요히 떨어지는 오동잎은\n누구의 발자취입니까',
    source: '한용운, 알 수 없어요',
    sub: null,
    months: [9, 10, 11],
  },
  {
    tier: 6,
    text: '추강에 밤이 드니\n물결이 차노매라',
    source: '월산대군, 시조',
    sub: null,
    months: [9, 10, 11],
    timeBand: ['night', 'midnight'],
  },
  {
    tier: 6,
    text: '동짓달 기나긴 밤을\n한 허리를 베어 내어',
    source: '황진이, 시조',
    sub: null,
    months: [12, 1, 2],
    timeBand: ['night', 'midnight'],
  },
  {
    tier: 6,
    text: '유리에 차고 슬픈 것이\n어른거린다',
    source: '정지용, 유리창',
    sub: null,
    months: [12, 1, 2],
  },

  // ── tier 7: 범용 폴백(무조건 매치 — 최종 안전망) ─────────────
  {
    tier: 7,
    text: '흐리지만\n비 소식은 없어요.',
    source: null,
    sub: null,
  },
  {
    tier: 7,
    text: '볕이 좋아요.\n걸어가도 기분 좋은 날.',
    source: null,
    sub: null,
  },
  {
    tier: 7,
    text: '나는 나룻배\n당신은 행인',
    source: '한용운, 나룻배와 행인',
    sub: null,
  },
]

/**
 * entry.mood(문자열 | 배열 | null)가 현재 mood와 맞는지 본다.
 * null/undefined면 mood 무관(와일드카드), 배열이면 그중 하나만 맞으면 된다.
 * @param {string|string[]|null|undefined} entryMood
 * @param {string} ctxMood
 */
function moodMatches(entryMood, ctxMood) {
  if (entryMood == null) return true
  if (Array.isArray(entryMood)) return entryMood.includes(ctxMood)
  return entryMood === ctxMood
}

/**
 * entry.timeOfDay(문자열 | 배열)가 현재 시간대와 맞는지 본다.
 * @param {string|string[]|undefined} entryTimeOfDay
 * @param {string} ctxTimeOfDay
 */
function timeOfDayMatches(entryTimeOfDay, ctxTimeOfDay) {
  if (Array.isArray(entryTimeOfDay)) return entryTimeOfDay.includes(ctxTimeOfDay)
  return entryTimeOfDay === ctxTimeOfDay
}

/**
 * 글귀 하나가 현재 컨텍스트에서 매칭되는지 판정한다. tier별 규칙은
 * 파일 상단 주석의 선택 우선순위와 1:1 대응한다.
 * @param {HeroGreeting} entry
 * @param {{mood: string, timeOfDay: string, hour: number, month: number, date: number, windSpeed: number|null, temp: number|null}} ctx
 */
function matchesTier(entry, ctx) {
  switch (entry.tier) {
    case 1:
      return entry.monthDay?.month === ctx.month && entry.monthDay?.day === ctx.date
    case 2:
      return entry.wind === true && ctx.windSpeed != null && ctx.windSpeed >= 6
    case 3:
      if (entry.heat) return ctx.temp != null && ctx.temp >= 32
      if (entry.cold) return ctx.temp != null && ctx.temp <= -5
      return false
    case 4: {
      // hourRange는 timeOfDay 고정 밴드보다 좁은 구간(예: 등교 시간 6~9시)을
      // 지정할 때 쓴다. hourRange가 있으면 그것으로, 없으면 timeOfDay로 본다.
      const timeOk = Array.isArray(entry.hourRange)
        ? ctx.hour >= entry.hourRange[0] && ctx.hour < entry.hourRange[1]
        : timeOfDayMatches(entry.timeOfDay, ctx.timeOfDay)
      return timeOk && moodMatches(entry.mood, ctx.mood)
    }
    case 5:
      return moodMatches(entry.mood, ctx.mood) && entry.mood != null
    case 6: {
      const monthOk = Array.isArray(entry.months) && entry.months.includes(ctx.month)
      const moodOk = moodMatches(entry.mood, ctx.mood)
      const timeOk = !entry.timeBand || entry.timeBand.includes(ctx.timeOfDay)
      return monthOk && moodOk && timeOk
    }
    case 7:
      return true
    default:
      return false
  }
}

/**
 * KST day-of-year를 시드로, 후보 배열에서 하루 동안 고정된 하나를 고른다.
 * @param {HeroGreeting[]} candidates
 * @param {number} dayOfYear
 */
function pickStableCandidate(candidates, dayOfYear) {
  const idx = dayOfYear % candidates.length
  return candidates[idx]
}

/**
 * 현재 시간대·날씨·날짜 맥락에 맞는 히어로 글귀 하나를 고른다.
 *
 * @param {Object} params
 * @param {'sunny'|'cloudy'|'rainy'|'snowy'} params.mood
 * @param {number|null} [params.rainProb] - 현재 우선순위 규칙에서는 쓰지
 *   않지만, 날씨 위젯과 동일한 입력 shape을 유지하기 위해 시그니처에 둔다.
 * @param {number|null} [params.windSpeed] - m/s. `jeongwangWind.js` 강풍
 *   기준(6m/s)과 동일한 임계값을 쓴다.
 * @param {number|null} [params.temp] - 섭씨.
 * @param {Date} [now]
 * @returns {{text: string, sub: string|null, source: string|null}}
 */
export function pickGreeting(params = {}, now = new Date()) {
  // rainProb는 현재 우선순위 규칙에서 쓰지 않지만, 날씨 위젯과 동일한 입력
  // shape을 유지하기 위해 params에는 남겨 둔다(호출부가 구조분해 없이 넘겨도 되게).
  const { mood, windSpeed, temp } = params
  const ctx = {
    mood,
    timeOfDay: getFineTimeOfDay(now),
    hour: getKstHour(now),
    month: getKstMonth(now),
    date: getKstDate(now),
    windSpeed,
    temp,
  }
  const dayOfYear = getKstDayOfYear(now)

  for (let tier = 1; tier <= 7; tier++) {
    const candidates = HERO_GREETINGS.filter((entry) => entry.tier === tier && matchesTier(entry, ctx))
    if (candidates.length > 0) {
      const picked = pickStableCandidate(candidates, dayOfYear)
      return {
        text: picked.text,
        source: picked.source ?? null,
        sub: picked.source ? null : (picked.sub ?? null),
      }
    }
  }

  // 이론상 tier 7이 항상 매칭되므로 도달하지 않지만, 방어적으로 안전한
  // 기본값을 반환한다.
  return { text: '오늘도 정왕에서 좋은 하루 보내세요.', source: null, sub: null }
}
