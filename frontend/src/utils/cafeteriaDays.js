/**
 * cafeteriaDays.js — 학식 요일 변환 유틸
 *
 * 백엔드 by_day 키(날짜 문자열 e.g. "11")와
 * week_start("5.11"), year(2026)로부터 요일 라벨과 오늘 키를 계산.
 */

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * KST 기준 주말(토/일) 여부를 반환한다.
 * @param {Date} date - 판단 기준 날짜 (기본값: 현재 시각)
 * @returns {boolean}
 */
export function isKstWeekend(date = new Date()) {
  const kstDay = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(date)
  return kstDay === 'Sat' || kstDay === 'Sun'
}

/**
 * week_start("5.11"), year(2026), by_day 키 배열(["11","12","13","14","15"])
 * → 각 날짜 키에 대응하는 요일 라벨 맵 { "11": "11일(월)", ... }
 */
export function buildDayLabelMap(weekStart, year, dayKeys) {
  if (!weekStart || !year || !dayKeys?.length) return {}
  const [mStr, dStr] = weekStart.split('.')
  const m = Number(mStr)
  const startDay = Number(dStr)
  if (!m || !startDay) return {}

  const result = {}
  for (const dk of dayKeys) {
    const d = Number(dk)
    if (!Number.isFinite(d)) continue
    const date = new Date(year, m - 1, d)
    const wd = WEEKDAY_LABELS[date.getDay()]
    result[dk] = `${d}일(${wd})`
  }
  return result
}

/**
 * KST 기준 오늘 날짜의 by_day 키를 반환. 해당 주차에 없으면 null.
 * week_start("5.11"), year(2026), dayKeys(["11","12","13","14","15"]) 필요.
 */
export function getTodayDayKey(weekStart, year, dayKeys) {
  if (!weekStart || !year || !dayKeys?.length) return null
  const [mStr, dStr] = weekStart.split('.')
  const m = Number(mStr)
  const startDay = Number(dStr)
  if (!m || !startDay) return null

  // KST 기준 오늘 날짜 (UTC+9)
  const nowUtc = Date.now()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstDate = new Date(nowUtc + kstOffset)
  const todayYear = kstDate.getUTCFullYear()
  const todayMonth = kstDate.getUTCMonth() + 1
  const todayDay = kstDate.getUTCDate()

  if (todayYear !== year || todayMonth !== m) return null

  const key = String(todayDay)
  return dayKeys.includes(key) ? key : null
}

/**
 * 식단 주차가 이미 지났는지(오늘이 주차 마지막 날 이후인지) 판정.
 * 원본(ibook 주간 식단표)이 다음 주차를 늦게 올리는 동안 지난주 식단이
 * 아무 표시 없이 보이면 이번 주 식단으로 오해한다 — 그때 "지난주 식단" 라벨을
 * 붙이기 위한 헬퍼. dayKeys가 월 경계를 넘는 주(7/27~8/1)도 처리한다.
 */
export function isMenuWeekStale(weekStart, year, dayKeys) {
  if (!weekStart || !year || !dayKeys?.length) return false
  const [mStr, dStr] = weekStart.split('.')
  const m = Number(mStr)
  const startDay = Number(dStr)
  if (!m || !startDay) return false

  // 주 시작일부터 최대 2주를 스캔해 dayKeys에 있는 마지막 날짜를 찾는다
  // (dayKeys는 day-of-month 문자열이라 월 경계를 스스로 알지 못한다).
  const keySet = new Set(dayKeys.map(String))
  let lastDate = null
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(year, m - 1, startDay + i))
    if (keySet.has(String(d.getUTCDate()))) lastDate = d
  }
  if (!lastDate) return false

  // KST 기준 오늘 (getTodayDayKey와 동일 방식)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayUtcMidnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  return todayUtcMidnight > lastDate.getTime()
}

/**
 * by_day의 첫 번째 키를 반환 (정렬 후). fallback용.
 */
export function getFirstDayKey(dayKeys) {
  if (!dayKeys?.length) return null
  return [...dayKeys].sort((a, b) => Number(a) - Number(b))[0]
}

/**
 * cafeteria 데이터에서 by_day 키 목록을 추출해 정렬 반환.
 * 여러 meal의 by_day 합집합.
 */
export function extractDayKeys(cafeteria) {
  if (!cafeteria?.meals?.length) return []
  const keySet = new Set()
  for (const meal of cafeteria.meals) {
    for (const k of Object.keys(meal.by_day ?? {})) {
      keySet.add(k)
    }
  }
  return [...keySet].sort((a, b) => Number(a) - Number(b))
}

/**
 * 특정 날짜 키에 실제 메뉴가 있는지 판정.
 * 모든 meal의 by_day[dayKey]가 빈 배열 또는 ["미운영"]이면 false.
 * 하나라도 실제 메뉴가 있으면 true.
 *
 * @param {object} cafeteria - { meals: [{ by_day: {} }] }
 * @param {string} dayKey    - 날짜 키 (예: "23")
 * @returns {boolean}
 */
export function hasDayMenu(cafeteria, dayKey) {
  if (!cafeteria?.meals?.length || !dayKey) return false
  return cafeteria.meals.some((meal) => {
    const items = meal.by_day?.[dayKey]
    if (!items || items.length === 0) return false
    if (items.length === 1 && items[0] === '미운영') return false
    return true
  })
}

/**
 * 오늘 날짜에서 가장 가까운 메뉴 있는 날짜 키를 반환.
 * 오늘 이후(당일 포함) 중 가장 빠른 날 → 없으면 오늘 이전 중 가장 최근 날.
 * 메뉴 있는 날이 하나도 없으면 getFirstDayKey() 결과 반환.
 *
 * @param {string} weekStart - "M.D" 형식 (예: "6.23")
 * @param {number} year      - 연도 (예: 2026)
 * @param {string[]} dayKeys - 정렬된 날짜 키 배열
 * @param {object} cafeteria - 메뉴 데이터 (hasDayMenu에 사용)
 * @returns {string|null}
 */
export function getNearestMenuDayKey(weekStart, year, dayKeys, cafeteria) {
  if (!dayKeys?.length) return null

  const daysWithMenu = dayKeys.filter((dk) => hasDayMenu(cafeteria, dk))
  if (!daysWithMenu.length) return getFirstDayKey(dayKeys)

  // KST 기준 오늘 날짜 숫자
  const nowUtc = Date.now()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstDate = new Date(nowUtc + kstOffset)
  const todayDay = kstDate.getUTCDate()
  const todayMonth = kstDate.getUTCMonth() + 1
  const todayYear = kstDate.getUTCFullYear()

  // week_start가 올해 같은 달인지 확인. 다른 달/해면 단순 첫 번째 반환.
  if (weekStart && year) {
    const [mStr] = weekStart.split('.')
    const m = Number(mStr)
    if (todayYear === year && todayMonth === m) {
      // 오늘 이후(당일 포함) 중 가장 빠른 메뉴 날
      const future = daysWithMenu.filter((dk) => Number(dk) >= todayDay)
      if (future.length) return future[0]
      // 없으면 오늘 이전 중 가장 최근 메뉴 날
      const past = [...daysWithMenu].filter((dk) => Number(dk) < todayDay)
      if (past.length) return past[past.length - 1]
    }
  }

  return daysWithMenu[0]
}
