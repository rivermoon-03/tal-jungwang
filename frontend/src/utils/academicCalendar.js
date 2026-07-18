/**
 * academicCalendar — 학사일정 D-day/날짜 표시 헬퍼.
 *
 * 서버가 주는 start_date/end_date는 "YYYY-MM-DD" 날짜 전용 문자열(시각 없음).
 * 이 값을 그냥 `new Date(str)`로 파싱해 브라우저 로컬 자정과 비교하면, 사용자
 * 타임존에 따라 하루가 밀리는 문제가 생길 수 있다(mistakes.md §1). 그래서
 * "오늘"도 Asia/Seoul 캘린더 날짜 문자열로 구해, 순수 날짜(day) 단위로만 diff한다.
 *
 * 표시 로직은 이 헬퍼로 일원화하고, 컴포넌트는 반드시 여기서 import해 쓴다
 * (mistakes.md §2 — 인라인 Math.* 복붙 금지 원칙과 동일하게 적용).
 */

const KST_TZ = 'Asia/Seoul'
const MS_PER_DAY = 86_400_000

// Asia/Seoul 기준 "오늘"을 "YYYY-MM-DD"로.
export function todayKstDateString(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST_TZ }).format(now)
}

// "YYYY-MM-DD" → UTC 자정 epoch(ms). 날짜만 비교하기 위한 순수 정수화(시각 없음).
function dateStringToUtcEpoch(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/**
 * startDate까지 남은 일수. 0=오늘, 양수=미래, 음수=이미 지남.
 * startDate가 없거나 형식이 잘못되면 null.
 */
export function ddayFrom(startDate, now = new Date()) {
  if (!startDate) return null
  const today = todayKstDateString(now)
  const diffMs = dateStringToUtcEpoch(startDate) - dateStringToUtcEpoch(today)
  if (Number.isNaN(diffMs)) return null
  return Math.round(diffMs / MS_PER_DAY)
}

// "D-N" / "D+N" / "D-DAY" 형식.
export function formatDday(startDate, now = new Date()) {
  const d = ddayFrom(startDate, now)
  if (d === null) return ''
  if (d === 0) return 'D-DAY'
  return d > 0 ? `D-${d}` : `D+${Math.abs(d)}`
}

function formatMonthDay(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return ''
  const [, m, d] = parts
  return `${m}월 ${d}일`
}

// 캘린더식 날짜 배지용 — start_date에서 월/일 숫자만 추출({month, day}). 형식 오류면 null.
export function dateBadgeParts(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [, m, d] = parts
  return { month: m, day: d }
}

// start~end가 다르면 "M월 D일 ~ M월 D일" 범위, 같으면 "M월 D일" 단일 날짜.
export function formatDateOrRange(startDate, endDate) {
  if (!startDate) return ''
  if (!endDate || endDate === startDate) return formatMonthDay(startDate)
  return `${formatMonthDay(startDate)} ~ ${formatMonthDay(endDate)}`
}

// ── 월간 그리드 캘린더용 순수 날짜 계산 ──────────────────────────────
// 이 아래 함수들은 시각(시:분:초)이 전혀 관여하지 않는 순수 캘린더 산수라서
// UTC epoch로 계산해도 KST wraparound 문제가 생기지 않는다(연/월/일 정수 연산).

// year(YYYY)/month(1~12)/day(1~31) → "YYYY-MM-DD".
export function dateStringFrom(year, month, day) {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// 해당 월(1~12)의 일수.
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// 해당 월(1~12) 1일의 요일. 0=일 ~ 6=토.
export function firstWeekdayOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

// {year, month}에서 delta개월 이동한 {year, month}(음수 delta 포함, month는 항상 1~12로 정규화).
export function shiftMonth(year, month, delta) {
  const totalMonths = year * 12 + (month - 1) + delta
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths - y * 12 + 1
  return { year: y, month: m }
}

// "2026년 7월" 형식.
export function monthLabel(year, month) {
  return `${year}년 ${month}월`
}

/**
 * 월간 캘린더 그리드 셀 배열(7의 배수 길이). 1일 앞은 null로 채우고,
 * 마지막 주도 7칸이 되도록 뒤를 null로 채운다. 각 날짜 셀은 { date, day }.
 */
export function buildMonthGrid(year, month) {
  const firstWeekday = firstWeekdayOfMonth(year, month)
  const total = daysInMonth(year, month)
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= total; day++) {
    cells.push({ date: dateStringFrom(year, month, day), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * dateStr이 [startDate, endDate] 범위(양끝 포함) 안에 있는지. endDate가 없으면
 * startDate와 동일한 단일 날짜로 취급.
 */
export function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr || !startDate) return false
  const end = endDate || startDate
  const d = dateStringToUtcEpoch(dateStr)
  const s = dateStringToUtcEpoch(startDate)
  const e = dateStringToUtcEpoch(end)
  if ([d, s, e].some(Number.isNaN)) return false
  return d >= s && d <= e
}
