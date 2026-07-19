/**
 * timeOfDay.js — KST 기준 낮/저녁/밤 시간대 판정 유틸
 *
 * CLAUDE.md 규칙: 시각은 항상 timezone-aware하게 비교한다. 로컬 브라우저
 * 시각(`new Date().getHours()`)을 직접 쓰면 사용자 기기 타임존에 따라
 * 판정이 어긋난다 — `venueOpen.js`의 `toKst()`와 동일한
 * `Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul' })` 패턴으로
 * KST hour를 뽑는다.
 *
 * 밴드: 낮 06:00~17:00, 저녁 17:00~20:00, 밤 20:00~06:00.
 */

/**
 * 주어진 Date를 KST 기준 시(hour, 0~23)로 변환한다.
 * @param {Date} now
 * @returns {number}
 */
export function getKstHour(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
  })
  const hour = parseInt(fmt.format(now), 10)
  // hour12:false 에서 자정=24로 오는 경우 보정
  return hour === 24 ? 0 : hour
}

/**
 * KST 기준 시각으로 낮/저녁/밤 시간대를 판정한다.
 * @param {Date} now
 * @returns {'day'|'evening'|'night'}
 */
export function getTimeOfDay(now = new Date()) {
  const hour = getKstHour(now)
  if (hour >= 6 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

/**
 * 주어진 Date를 KST 기준 "HH:MM" 라벨로 변환한다.
 * 여러 화면이 브라우저 로컬 `getHours()/getMinutes()`로 같은 포맷을 각자
 * 만들어 왔는데(SchedulePage, FavoritesList 등) 그 값은 tz-aware하지 않다
 * (CLAUDE.md 철칙: 시각은 항상 timezone-aware하게 비교). 신규 코드는
 * 이 헬퍼로 KST를 명시한다.
 * @param {Date} now
 * @returns {string} 예: "14:32"
 */
export function getKstHourMinuteLabel(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return fmt.format(now)
}

const DOW_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/**
 * 주어진 Date를 KST 기준 요일 인덱스(0=일요일 ~ 6=토요일, Date.getDay()와 동일 규약)로 변환한다.
 * `Date.getDay()`를 직접 쓰면 브라우저 로컬 타임존 기준이라 자정 근처에서 날짜가 어긋난다.
 * @param {Date} now
 * @returns {number}
 */
export function getKstDayOfWeek(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' })
  return DOW_INDEX[fmt.format(now)]
}
