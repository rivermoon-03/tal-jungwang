/**
 * academicWeekLanes — 학사일정 주간 뷰의 "겹침 없는 레인 배치" 헬퍼.
 *
 * 기존 주간 뷰는 요일을 세로로 나열하고, 며칠에 걸친 기간 일정(예: 수강신청
 * 미리담기 월~수)을 그 기간에 속한 날짜마다 같은 제목으로 중복 표시했다. 이
 * 헬퍼는 대신 일정을 "주 그리드 위의 가로 막대(레인)"로 변환해, 기간 일정이
 * 한 줄로만 보이게 한다.
 *
 * 날짜 클리핑은 academicCalendar.js의 buildWeekGrid/isDateInRange를 그대로
 * 재사용한다 — 날짜 epoch 파싱을 이 파일에서 새로 만들지 않는다(mistakes.md
 * 상위 원칙 1: 인라인 중복 로직 금지, 헬퍼 재사용).
 */
import { buildWeekGrid, isDateInRange } from './academicCalendar'

// 제목 키워드로 카테고리를 분류한다. 서버(academic_calendar 테이블)가 별도
// category 컬럼을 내려주지 않으므로 클라이언트에서 제목으로 파생한다. 칩
// 팔레트(색상 클래스) 매핑은 표시 관심사라 컴포넌트 쪽 상수(CATEGORY_STYLE)로
// 분리하고, 이 헬퍼는 카테고리 "이름"만 판정한다.
const CATEGORY_KEYWORDS = [
  { category: 'enrollment', keywords: ['수강'] }, // 수강신청/수강정정/수강철회/재수강신청 등
  { category: 'degree', keywords: ['졸업', '학위'] },
  { category: 'registration', keywords: ['등록'] },
]

export function categorizeEvent(title) {
  const t = title || ''
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => t.includes(kw))) return category
  }
  return 'etc'
}

// weekDates(7개 "YYYY-MM-DD", 일~토)에 대해 [startDate, endDate] 범위를
// 클리핑한다. 주와 전혀 겹치지 않으면 null.
function clipToWeek(weekDates, startDate, endDate) {
  let startIdx = -1
  let endIdx = -1
  for (let i = 0; i < weekDates.length; i++) {
    if (isDateInRange(weekDates[i], startDate, endDate)) {
      if (startIdx === -1) startIdx = i
      endIdx = i
    }
  }
  if (startIdx === -1) return null
  return { colStart: startIdx + 1, span: endIdx - startIdx + 1 }
}

/**
 * events(각 {title, start_date, end_date})를 weekStart가 속한 주(일~토)
 * 그리드 위의 레인 배열로 변환한다. weekStart는 그 주에 속하는 아무 날짜나
 * 줘도 된다(buildWeekGrid가 내부에서 일요일로 정규화).
 *
 * 반환: [{ title, category, colStart(1~7), span, row(0-based) }, ...]
 * - 주 밖 일정은 결과에서 제외한다.
 * - 주 경계에 걸치는 일정은 그 주 안으로 클리핑한다(colStart/span이 항상
 *   1~7 범위 안에 들어오도록).
 * - 겹치는 레인은 그리디로 행(row)을 나눠 배치한다: colStart 오름차순(동률이면
 *   span이 큰 레인 먼저)으로 정렬한 뒤, 각 행이 마지막으로 채운 컬럼보다 뒤에서
 *   시작하는 레인만 그 행에 이어붙이고, 안 맞으면 새 행을 연다.
 */
export function buildWeekLanes(events, weekStart) {
  const weekDates = buildWeekGrid(weekStart).map((cell) => cell.date)

  const clipped = (events || [])
    .map((ev) => {
      if (!ev?.start_date) return null
      const end = ev.end_date || ev.start_date
      const clip = clipToWeek(weekDates, ev.start_date, end)
      if (!clip) return null
      return { title: ev.title, category: categorizeEvent(ev.title), colStart: clip.colStart, span: clip.span }
    })
    .filter(Boolean)
    .sort((a, b) => a.colStart - b.colStart || b.span - a.span)

  const rowLastCol = [] // rowLastCol[row] = 그 행에서 마지막으로 채운 컬럼(colStart+span-1)
  return clipped.map((lane) => {
    let row = rowLastCol.findIndex((lastCol) => lastCol < lane.colStart)
    const laneEndCol = lane.colStart + lane.span - 1
    if (row === -1) {
      row = rowLastCol.length
      rowLastCol.push(laneEndCol)
    } else {
      rowLastCol[row] = laneEndCol
    }
    return { ...lane, row }
  })
}

// 주간 뷰 상세 목록용 "일 단위" 기간 라벨. 같은 달 안이면 월을 생략해
// "20일~22일"처럼 짧게, 달이 걸치면 "7월 31일~8월 2일"로 표기한다.
// 월간 뷰의 formatDateOrRange("M월 D일 ~ M월 D일")와는 의도적으로 다른
// 포맷이다 — 주간 뷰는 이미 주 단위 맥락이 보여서 더 압축된 표기가 맞다.
export function formatDayRangeLabel(startDate, endDate) {
  if (!startDate) return ''
  const end = endDate || startDate
  const startParts = startDate.split('-').map(Number)
  const endParts = end.split('-').map(Number)
  if (startParts.length !== 3 || endParts.length !== 3) return ''
  const [, sm, sd] = startParts
  const [, em, ed] = endParts
  if (startDate === end) return `${sd}일`
  if (sm === em) return `${sd}일~${ed}일`
  return `${sm}월 ${sd}일~${em}월 ${ed}일`
}
