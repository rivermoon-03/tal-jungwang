/**
 * venueOpen.js — KST 기준 영업 상태 스마트 안내 순수함수
 *
 * venue shape (구형 호환):
 *   {
 *     alwaysOpen?: boolean,
 *     is24h?: boolean,             // 신형: alwaysOpen과 동일 의미
 *     hours?: [{ start: 'HH:MM', end: 'HH:MM' }],   // 단일 시간대 또는 복수 시간대
 *     meals?: [{ type: string, start: 'HH:MM', end: 'HH:MM' }],  // 학식 끼니 구조
 *     closedDays?: ('sunday'|'monday'|...|'saturday'|'holiday')[],
 *     schedule?: {                 // 신형: 학기/방학 + 요일별 스케줄
 *       semester: { weekday, saturday, sunday },
 *       vacation: { weekday, saturday, sunday },
 *     }
 *   }
 *
 * returns: {
 *   open: boolean,
 *   status: 'open'|'closing'|'before_open'|'after_close'|'closed_day'|'always',
 *   nextChange?: string,           // 'HH:MM' 형태 (하위 호환용)
 *   primaryLabel: string,          // 주 상태 텍스트
 *   subLabel: string|null,         // 스마트 다음 변화 텍스트
 *   currentPart: { type: string|null, end: string }|null,
 * }
 */

import {
  UtensilsCrossed,
  Soup,
  Utensils,
  Beef,
  Coffee,
  Store,
} from 'lucide-react'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/**
 * Date를 KST 기준 { dow, weekday, hour, minute, totalMin } 로 분해
 * Intl.DateTimeFormat으로 KST 변환 (Asia/Seoul, UTC+9)
 */
function toKst(now) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''

  const weekday = get('weekday').toLowerCase()
  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)

  // 'hour12:false' 에서 자정=24 로 오는 경우 보정
  const h = hour === 24 ? 0 : hour
  const dow = DAY_NAMES.indexOf(weekday)

  return { dow, weekday, hour: h, minute, totalMin: h * 60 + minute }
}

/**
 * 'HH:MM' 문자열을 분(minutes)으로 변환
 */
function timeToMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * 분을 'HH:MM' 문자열로 변환
 */
function minToHhmm(min) {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 분 차이를 한국어 시간 표현으로 변환
 * 60분 미만 → "N분 후"
 * 60분 이상 → "N시간 후" 또는 "N시간 M분 후"
 */
function formatCountdown(diffMin) {
  if (diffMin < 60) {
    return `${diffMin}분 후`
  }
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  if (mins === 0) {
    return `${hours}시간 후`
  }
  return `${hours}시간 ${mins}분 후`
}

/**
 * venue에서 오늘(dow 기준) + 이후 최대 7일 탐색하여
 * 가장 빠른 영업 시작 슬롯을 반환
 * schedule 구조와 구형 hours/meals 구조 모두 지원
 * @returns {{ daysAhead: number, startHhmm: string, startDow: number }|null}
 */
function findNextOpen(venue, kstInfo, now) {
  const { dow, totalMin } = kstInfo
  const closedDays = venue.closedDays ?? []

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const checkDow = (dow + daysAhead) % 7
    const checkWeekday = DAY_NAMES[checkDow]

    if (closedDays.includes(checkWeekday)) continue

    // daysAhead 후의 날짜를 계산해 그 날의 슬롯을 가져옴
    const checkDate = now ? new Date(now.getTime() + daysAhead * 86400000) : new Date()
    const checkKstInfo = { ...kstInfo, dow: checkDow, weekday: checkWeekday }
    const slots = venue.schedule
      ? resolveSlots(venue, checkKstInfo, checkDate)
      : (venue.meals ?? venue.hours ?? [])

    for (const slot of slots) {
      const startMin = timeToMin(slot.start)
      // 오늘(daysAhead===0)이면 현재 시각 이후 슬롯만
      if (daysAhead === 0 && startMin <= totalMin) continue
      return { daysAhead, startHhmm: slot.start, startDow: checkDow }
    }
  }

  return null
}

/**
 * 다음 영업 시작 subLabel 생성
 * @param {{ daysAhead: number, startHhmm: string, startDow: number }} nextOpen
 * @param {number} nowTotalMin - 현재 KST 총 분
 */
function buildNextOpenSubLabel(nextOpen, nowTotalMin) {
  if (!nextOpen) return null

  const { daysAhead, startHhmm, startDow } = nextOpen

  if (daysAhead === 0) {
    // 오늘 중 다음 시작
    const startMin = timeToMin(startHhmm)
    const diffMin = startMin - nowTotalMin
    return `${formatCountdown(diffMin)} 영업 시작`
  }

  if (daysAhead === 1) {
    return `다음 날 ${startHhmm} 영업 시작`
  }

  // 2일 이상 — 요일 표기
  return `${DAY_KO[startDow]} ${startHhmm} 영업 시작`
}

/**
 * 휴무일 여부 판정
 */
function isClosedDay(venue, kstInfo) {
  const { closedDays = [] } = venue
  if (closedDays.length === 0) return false
  return closedDays.includes(kstInfo.weekday)
}

/**
 * isOpenNow — 메인 공개 함수
 * schedule 구조(학기/방학 + 요일)와 구형 meals/hours 모두 지원
 *
 * @param {object} venue
 * @param {Date}   now  — 기본값 new Date() (현재 시각)
 * @returns {{
 *   open: boolean,
 *   status: 'open'|'closing'|'before_open'|'after_close'|'closed_day'|'always',
 *   nextChange?: string,
 *   primaryLabel: string,
 *   subLabel: string|null,
 *   currentPart: { type: string|null, end: string }|null,
 * }}
 */
export function isOpenNow(venue, now = new Date()) {
  // 24시간 장소 (구형 alwaysOpen 또는 신형 is24h)
  if (venue.alwaysOpen || venue.is24h) {
    return {
      open: true,
      status: 'always',
      primaryLabel: '24시간 영업',
      subLabel: null,
      currentPart: null,
    }
  }

  const kstInfo = toKst(now)

  // 휴무일 확인
  if (isClosedDay(venue, kstInfo)) {
    const nextOpen = findNextOpen(venue, kstInfo, now)
    const subLabel = buildNextOpenSubLabel(nextOpen, kstInfo.totalMin)
    return {
      open: false,
      status: 'closed_day',
      primaryLabel: '오늘 휴무',
      subLabel,
      currentPart: null,
    }
  }

  const { totalMin } = kstInfo

  // schedule 구조 또는 구형 meals/hours 중 오늘에 해당하는 슬롯 추출
  const slots = resolveSlots(venue, kstInfo, now)

  // 방학 + 빈 슬롯 = 방학 휴무(after_close 처리)
  if (slots.length === 0) {
    const nextOpen = findNextOpen(venue, kstInfo, now)
    const subLabel = buildNextOpenSubLabel(nextOpen, totalMin)
    return {
      open: false,
      status: 'after_close',
      primaryLabel: '영업 종료',
      subLabel,
      currentPart: null,
    }
  }

  // 현재 시각이 속한 슬롯 탐색
  for (const slot of slots) {
    const startMin = timeToMin(slot.start)
    const endMin = timeToMin(slot.end)

    if (totalMin >= startMin && totalMin < endMin) {
      const remaining = endMin - totalMin
      const nextChange = minToHhmm(endMin)
      // meals 구조면 type, hours 구조면 null
      const currentPart = { type: slot.type ?? null, end: slot.end }

      if (remaining < 60) {
        return {
          open: true,
          status: 'closing',
          nextChange,
          primaryLabel: '영업 중',
          subLabel: `${nextChange} 영업 종료`,
          currentPart,
        }
      }

      return {
        open: true,
        status: 'open',
        nextChange,
        primaryLabel: '영업 중',
        subLabel: `${nextChange} 영업 종료`,
        currentPart,
      }
    }
  }

  // 현재 슬롯 없음 — before_open 또는 after_close 판단
  // 오늘 아직 열리지 않은 슬롯이 있으면 before_open
  const futureSlot = slots.find((slot) => timeToMin(slot.start) > totalMin)

  if (futureSlot) {
    // 영업 전: 오늘 중 첫 슬롯까지 남은 시간
    const startMin = timeToMin(futureSlot.start)
    const diffMin = startMin - totalMin
    const subLabel = `${formatCountdown(diffMin)} 영업 시작`
    return {
      open: false,
      status: 'before_open',
      primaryLabel: '영업 전',
      subLabel,
      currentPart: null,
    }
  }

  // 영업 종료: 오늘 모든 슬롯 끝남 — 다음 영업 탐색
  const nextOpen = findNextOpen(venue, kstInfo, now)
  const subLabel = buildNextOpenSubLabel(nextOpen, totalMin)

  return {
    open: false,
    status: 'after_close',
    primaryLabel: '영업 종료',
    subLabel,
    currentPart: null,
  }
}

// ── 학기/방학 판정 ───────────────────────────────────────────────

/**
 * 주어진 날짜가 방학 기간인지 판정
 * 하계 방학: 6월 22일 ~ 8월 31일
 * 동계 방학: 12월 22일 ~ 2월 28일(윤년 2월 29일 포함)
 * KST 기준 월/일로 판정 (단순 어림)
 *
 * @param {Date} date
 * @returns {boolean}
 */
export function isVacationPeriod(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10)
  const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '1', 10)

  // 하계 방학: 6월 22일 ~ 8월 31일
  const isSummer =
    (month === 6 && day >= 22) ||
    month === 7 ||
    month === 8

  // 동계 방학: 12월 22일 ~ 2월 28/29일
  const isWinter =
    (month === 12 && day >= 22) ||
    month === 1 ||
    month === 2

  return isSummer || isWinter
}

// ── 카테고리 아이콘 헬퍼 ────────────────────────────────────────

/**
 * 카테고리 → lucide-react 아이콘 컴포넌트 매핑
 * lucide-react에 실제 존재하는 아이콘만 사용
 *
 * @param {string} category
 * @returns {React.ComponentType}
 */
export function getCategoryIcon(category) {
  switch (category) {
    case '한식':      return UtensilsCrossed
    case '분식':      return Soup
    case '중식':      return Soup
    case '양식':      return Utensils
    case '패스트푸드': return Beef
    case '카페':      return Coffee
    case '편의점':    return Store
    default:          return Utensils
  }
}

// ── building/floor → 표시 문자열 헬퍼 ───────────────────────────

/**
 * building + floor → 위치 표시 문자열
 * 예) getVenueLocation('TIP', 'B1') → 'TIP B1'
 *
 * @param {string} building
 * @param {string|undefined} floor
 * @returns {string}
 */
export function getVenueLocation(building, floor) {
  if (!floor) return building
  return `${building} ${floor}`
}

// ── schedule 슬롯 추출 헬퍼 ──────────────────────────────────────

/**
 * venue의 schedule 또는 하위호환 meals/hours에서
 * 현재 시점에 맞는 슬롯 배열을 반환
 *
 * @param {object} venue
 * @param {{ weekday: string, dow: number }} kstInfo
 * @param {Date} now
 * @returns {{ type: string, start: string, end: string }[]}
 */
function resolveSlots(venue, kstInfo, now) {
  // 신형 schedule 구조
  if (venue.schedule) {
    const period = isVacationPeriod(now) ? 'vacation' : 'semester'
    const periodSchedule = venue.schedule[period]
    if (!periodSchedule) return []

    const dow = kstInfo.dow // 0=sunday ... 6=saturday
    if (dow === 0) return periodSchedule.sunday ?? []
    if (dow === 6) return periodSchedule.saturday ?? []
    return periodSchedule.weekday ?? []
  }

  // 구형 호환: meals 또는 hours
  return venue.meals ?? venue.hours ?? []
}

// ── 건물 추출 & 색상 헬퍼 ─────────────────────────────────────

/**
 * location 문자열에서 건물 키를 추출
 * "TIP B1" / "푸드코트 TIP B1" / "TIP 1층" → "TIP"
 * "E동 1층" → "E동"
 * "중앙도서관 1층" → "중앙도서관"
 *
 * @param {string} location
 * @returns {string} 건물 키 ('TIP'|'E동'|'중앙도서관'|'기타')
 */
export function getVenueBuilding(location) {
  if (!location) return '기타'
  if (location.includes('TIP')) return 'TIP'
  if (location.includes('E동')) return 'E동'
  if (location.includes('중앙도서관')) return '중앙도서관'
  return '기타'
}

/**
 * 건물 키 → 카테고리 칩 팔레트(DESIGN.md) 기반 구분색 { color, bg }
 * CSS 변수(--tj-chip-*)를 그대로 참조하므로 라이트/다크 전환은 .dark 스코프에서
 * 자동 처리된다 — 호출부에서 다크모드 분기가 필요 없다.
 *
 * @param {string} building
 * @returns {{ color: string, bg: string }}
 */
export function getBuildingColor(building) {
  switch (building) {
    case 'TIP':
      // 주 캠퍼스 빌딩 — blue
      return { color: 'var(--tj-chip-blue-fg)', bg: 'var(--tj-chip-blue-bg)' }
    case 'E동':
      // 테라코타 계열에 가장 가까운 — yellow
      return { color: 'var(--tj-chip-yellow-fg)', bg: 'var(--tj-chip-yellow-bg)' }
    case '중앙도서관':
      // 세이지 그린 계열 — green
      return { color: 'var(--tj-chip-green-fg)', bg: 'var(--tj-chip-green-bg)' }
    default:
      // 기본 중립
      return { color: 'var(--tj-chip-gray-fg)', bg: 'var(--tj-chip-gray-bg)' }
  }
}

/**
 * 학식/매점 카테고리 → 카테고리 칩 팔레트(DESIGN.md) 기반 구분색 { color, bg }
 * CSS 변수(--tj-chip-*)를 그대로 참조하므로 라이트/다크 전환은 .dark 스코프에서
 * 자동 처리된다 — 호출부에서 다크모드 분기가 필요 없다.
 *
 * @param {string} category
 * @returns {{ color: string, bg: string }}
 */
export function getCategoryStyle(category) {
  const TONE = {
    '한식':      'yellow',
    '중식':      'yellow',
    '분식':      'red',
    '양식':      'green',
    '패스트푸드': 'purple',
    '카페':      'gray',
    '편의점':    'blue',
  }
  const tone = TONE[category] ?? 'gray'
  return { color: `var(--tj-chip-${tone}-fg)`, bg: `var(--tj-chip-${tone}-bg)` }
}
