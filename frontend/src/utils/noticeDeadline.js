/**
 * noticeDeadline — 공지 제목에서 마감일을 추출해 D-day를 계산하는 헬퍼.
 *
 * 백엔드 SchoolBoardNotice 모델(app/models/school.py)에는 마감일 컬럼이 없다 —
 * 제목·게시일·원문링크만 수집한다. 그런데 장학·모집 공지 제목에는 "9/15(월)까지",
 * "~9.15", "9월 15일까지" 같은 마감 표기가 실려 있는 경우가 많아, 제목 텍스트에서
 * 그 표기를 파싱해 D-day 배지를 만든다. 패턴이 없으면 조용히 null을 반환한다 —
 * 모든 공지에 억지로 D-day를 붙이지 않고 "마감이 있는 공지"만 대상으로 한다.
 *
 * D-day 계산 자체는 academicCalendar.ddayFrom과 같은 규칙(Asia/Seoul 날짜 단위
 * 비교)을 그대로 재사용한다 — 인라인 Math.* 복붙 금지 원칙.
 */
import { ddayFrom } from './academicCalendar'

const YMD_PATTERN = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*\(?[월화수목금토일]?\)?\s*(?:까지|마감)/
const MD_SLASH_PATTERN = /(\d{1,2})[.\-/](\d{1,2})\s*\(?[월화수목금토일]?\)?\s*(?:까지|마감)/
const MD_KOREAN_PATTERN = /(\d{1,2})월\s*(\d{1,2})일\s*\(?[월화수목금토일]?\)?\s*(?:까지|마감)/

function normalizeDate(year, month, day) {
  if (!year || !month || !day) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/**
 * 제목에서 마감일을 "YYYY-MM-DD" 문자열로 추출한다. 연도가 없는 표기(9/15까지 등)는
 * 게시일 기준으로 가장 가까운 미래로 추정한다 — 예를 들어 12월에 올라온 "1/5까지"는
 * 게시월보다 한참 이른 달이므로 내년으로 본다. 못 찾으면 null.
 */
export function parseNoticeDeadline(title, publishedAt = null) {
  if (!title) return null

  const ymdMatch = title.match(YMD_PATTERN)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return normalizeDate(Number(y), Number(m), Number(d))
  }

  const mdMatch = title.match(MD_SLASH_PATTERN) || title.match(MD_KOREAN_PATTERN)
  if (mdMatch) {
    const [, m, d] = mdMatch
    const refDate = publishedAt ? new Date(publishedAt) : new Date()
    const refValid = !Number.isNaN(refDate.getTime())
    const refYear = refValid ? refDate.getFullYear() : new Date().getFullYear()
    const refMonth = refValid ? refDate.getMonth() + 1 : new Date().getMonth() + 1
    // 마감월이 게시월보다 6개월 이상 이르면 해를 넘긴 표기로 본다(연말 게시 + 연초 마감).
    const year = Number(m) < refMonth - 6 ? refYear + 1 : refYear
    return normalizeDate(year, Number(m), Number(d))
  }

  return null
}

/** 남은 일수(0=오늘, 음수 제외). 마감을 못 찾거나 이미 지났으면 null. */
export function noticeDdayNumber(title, publishedAt = null, now = new Date()) {
  const deadline = parseNoticeDeadline(title, publishedAt)
  if (!deadline) return null
  const d = ddayFrom(deadline, now)
  if (d === null || d < 0) return null
  return d
}

/** "D-N" / "D-DAY" 형식. 마감이 없거나 이미 지났으면 null(빈 문자열이 아니라 null —
 * 호출부가 "배지를 아예 그리지 않는다"를 명시적으로 분기하도록). */
export function formatNoticeDday(title, publishedAt = null, now = new Date()) {
  const d = noticeDdayNumber(title, publishedAt, now)
  if (d === null) return null
  return d === 0 ? 'D-DAY' : `D-${d}`
}

/** D-3 이내(오늘 포함)면 임박 — imminent 토큰 적용 기준. */
export function isNoticeDdayImminent(title, publishedAt = null, now = new Date()) {
  const d = noticeDdayNumber(title, publishedAt, now)
  return d !== null && d <= 3
}
