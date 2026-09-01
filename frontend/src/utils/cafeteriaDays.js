/**
 * cafeteriaDays.js — 학식 요일 변환 유틸
 *
 * 백엔드 by_day 키는 "일(day-of-month)" 문자열이라(e.g. "31") 그 자체로는
 * 몇 월인지 모른다. 주차가 달을 넘기면(8/31~9/4) 키만 보고 정렬·요일 계산을
 * 하면 전부 틀어지므로, week_start("8.31")와 year(2026)에서 시작일을 잡고
 * 하루씩 전진하며 각 키의 실제 날짜를 복원해 쓴다. 이 파일의 모든 함수가
 * 그 날짜 맵(buildDayDateMap) 위에서 동작한다.
 */

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const MS_PER_DAY = 24 * 60 * 60 * 1000

// 한 주차의 날짜 칸은 월~토 6개가 최대다. 시트 제목이 하루 어긋나는 경우까지
// 감안해 8일만 훑는다 - 더 넓히면 같은 day-of-month가 두 번 걸릴 수 있다.
const WEEK_SCAN_DAYS = 8

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
 * week_start("8.31") + year → 주차 시작일의 UTC 자정 타임스탬프.
 * 이후 날짜 계산은 전부 UTC 산술로 해서 로컬 타임존/DST 영향을 받지 않는다.
 *
 * @returns {number|null}
 */
function weekStartUtcMs(weekStart, year) {
  if (!weekStart || !year) return null
  const [mStr, dStr] = String(weekStart).split('.')
  const m = Number(mStr)
  const d = Number(dStr)
  if (!m || !d) return null
  return Date.UTC(year, m - 1, d)
}

/** KST 기준 오늘 날짜의 UTC 자정 타임스탬프. */
function kstTodayUtcMs() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
}

/**
 * by_day 키 → 실제 날짜(UTC 자정 타임스탬프) 맵.
 * 주차 시작일부터 하루씩 전진하며 처음 일치한 키에 그 날짜를 준다.
 *
 * @param {string} weekStart - "M.D" (예: "8.31")
 * @param {number} year
 * @param {string[]} dayKeys
 * @returns {Record<string, number>}
 */
export function buildDayDateMap(weekStart, year, dayKeys) {
  const startMs = weekStartUtcMs(weekStart, year)
  if (startMs === null || !dayKeys?.length) return {}

  const pending = new Set(dayKeys.map(String))
  const result = {}
  for (let i = 0; i < WEEK_SCAN_DAYS && pending.size > 0; i++) {
    const ms = startMs + i * MS_PER_DAY
    const key = String(new Date(ms).getUTCDate())
    if (pending.has(key)) {
      result[key] = ms
      pending.delete(key)
    }
  }
  return result
}

/**
 * 날짜 맵이 있으면 실제 날짜순, 없으면 숫자순으로 키를 정렬한다.
 * (월 경계를 넘는 주차에서 숫자순은 31일을 맨 뒤로 보내 버린다.)
 */
function sortDayKeys(dayKeys, dateMap) {
  return [...dayKeys].sort((a, b) => {
    const da = dateMap[a]
    const db = dateMap[b]
    if (da !== undefined && db !== undefined) return da - db
    return Number(a) - Number(b)
  })
}

/**
 * week_start("5.11"), year(2026), by_day 키 배열(["11","12","13","14","15"])
 * → 각 날짜 키에 대응하는 요일 라벨 맵 { "11": "11일(월)", ... }
 */
export function buildDayLabelMap(weekStart, year, dayKeys) {
  if (!weekStart || !year || !dayKeys?.length) return {}
  const dateMap = buildDayDateMap(weekStart, year, dayKeys)

  const result = {}
  for (const dk of dayKeys) {
    const ms = dateMap[dk]
    if (ms === undefined) continue
    const wd = WEEKDAY_LABELS[new Date(ms).getUTCDay()]
    result[dk] = `${Number(dk)}일(${wd})`
  }
  return result
}

/**
 * KST 기준 오늘 날짜의 by_day 키를 반환. 해당 주차에 없으면 null.
 * week_start("5.11"), year(2026), dayKeys(["11","12","13","14","15"]) 필요.
 */
export function getTodayDayKey(weekStart, year, dayKeys) {
  if (!weekStart || !year || !dayKeys?.length) return null
  const dateMap = buildDayDateMap(weekStart, year, dayKeys)
  const today = kstTodayUtcMs()
  for (const [key, ms] of Object.entries(dateMap)) {
    if (ms === today) return key
  }
  return null
}

/**
 * 식단 주차가 이미 지났는지(오늘이 주차 마지막 날 이후인지) 판정.
 * 원본(ibook 주간 식단표)이 다음 주차를 늦게 올리는 동안 지난주 식단이
 * 아무 표시 없이 보이면 이번 주 식단으로 오해한다 - 그때 "지난주 식단" 라벨을
 * 붙이기 위한 헬퍼. dayKeys가 월 경계를 넘는 주(7/27~8/1)도 처리한다.
 */
export function isMenuWeekStale(weekStart, year, dayKeys) {
  if (!weekStart || !year || !dayKeys?.length) return false
  const dates = Object.values(buildDayDateMap(weekStart, year, dayKeys))
  if (!dates.length) return false
  return kstTodayUtcMs() > Math.max(...dates)
}

/**
 * 날짜순 첫 번째 키를 반환 (fallback용).
 * weekStart/year를 주면 월 경계를 넘는 주차도 올바르게 정렬한다.
 *
 * @param {string[]} dayKeys
 * @param {string} [weekStart]
 * @param {number} [year]
 * @returns {string|null}
 */
export function getFirstDayKey(dayKeys, weekStart, year) {
  if (!dayKeys?.length) return null
  const dateMap = buildDayDateMap(weekStart, year, dayKeys)
  return sortDayKeys(dayKeys, dateMap)[0]
}

/**
 * cafeteria 데이터에서 by_day 키 목록을 추출해 날짜순으로 반환.
 * 여러 meal의 by_day 합집합.
 *
 * weekStart/year를 주면 실제 날짜순으로 정렬한다. 주지 않으면 숫자순이라
 * 월 경계를 넘는 주차(8/31, 9/1...)에서 31일이 맨 뒤로 밀린다.
 *
 * @param {object} cafeteria
 * @param {string} [weekStart]
 * @param {number} [year]
 * @returns {string[]}
 */
export function extractDayKeys(cafeteria, weekStart, year) {
  if (!cafeteria?.meals?.length) return []
  const keySet = new Set()
  for (const meal of cafeteria.meals) {
    for (const k of Object.keys(meal.by_day ?? {})) {
      keySet.add(k)
    }
  }
  const keys = [...keySet]
  return sortDayKeys(keys, buildDayDateMap(weekStart, year, keys))
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
 * @param {string[]} dayKeys - 날짜 키 배열
 * @param {object} cafeteria - 메뉴 데이터 (hasDayMenu에 사용)
 * @returns {string|null}
 */
export function getNearestMenuDayKey(weekStart, year, dayKeys, cafeteria) {
  if (!dayKeys?.length) return null

  const dateMap = buildDayDateMap(weekStart, year, dayKeys)
  const daysWithMenu = sortDayKeys(
    dayKeys.filter((dk) => hasDayMenu(cafeteria, dk)),
    dateMap,
  )
  if (!daysWithMenu.length) return getFirstDayKey(dayKeys, weekStart, year)

  const today = kstTodayUtcMs()
  const dated = daysWithMenu.filter((dk) => dateMap[dk] !== undefined)

  // 오늘 이후(당일 포함) 중 가장 빠른 메뉴 날
  const future = dated.filter((dk) => dateMap[dk] >= today)
  if (future.length) return future[0]
  // 없으면 오늘 이전 중 가장 최근 메뉴 날
  const past = dated.filter((dk) => dateMap[dk] < today)
  if (past.length) return past[past.length - 1]

  return daysWithMenu[0]
}
