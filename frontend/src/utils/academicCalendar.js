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

// start~end가 다르면 "M월 D일 ~ M월 D일" 범위, 같으면 "M월 D일" 단일 날짜.
export function formatDateOrRange(startDate, endDate) {
  if (!startDate) return ''
  if (!endDate || endDate === startDate) return formatMonthDay(startDate)
  return `${formatMonthDay(startDate)} ~ ${formatMonthDay(endDate)}`
}
