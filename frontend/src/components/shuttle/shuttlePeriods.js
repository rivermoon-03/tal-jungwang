/**
 * 셔틀 운행 기간(schedule_periods) 표시용 순수 헬퍼.
 *
 * 학교 방학 시간표 PDF는 기간을 계절학기(빨강)/단축근무(초록)/정상근무(검정)로
 * 색상 구분한다 — 여기의 VARIANT 메타가 그 구분을 앱 칩 팔레트(DESIGN.md
 * "카테고리 칩 팔레트")로 옮긴 단일 출처다. ScheduleDetailModal의 기간 전환
 * 칩과 시간표 행의 variant 도트가 함께 쓴다.
 */

// entries.variant / 기간 이름 → 색·라벨. 키는 백엔드 variant 값과 동일.
export const PERIOD_VARIANTS = {
  seasonal: {
    label: '계절학기',
    chipClass: 'bg-chip-red-bg text-chip-red-fg',
    dotClass: 'bg-chip-red-fg',
  },
  reduced: {
    label: '단축근무',
    chipClass: 'bg-chip-green-bg text-chip-green-fg',
    dotClass: 'bg-chip-green-fg',
  },
  normal: {
    label: '정상근무',
    chipClass: 'bg-chip-blue-bg text-chip-blue-fg',
    dotClass: 'bg-chip-blue-fg',
  },
}

// 기간 이름에서 대표 variant 키를 유도한다. 계절학기 복합 기간
// ('계절학기(정상근무)')은 학교 PDF 요약표처럼 계절학기(빨강)를 우선한다.
export function periodVariantKey(period) {
  const name = period?.name ?? ''
  if (name.includes('계절학기')) return 'seasonal'
  if (name.includes('단축')) return 'reduced'
  if (name.includes('정상')) return 'normal'
  return null
}

// '여름방학 · 단축근무' → '단축근무' (칩은 좁아서 공통 접두어를 뗀다)
export function shortPeriodName(name) {
  const idx = (name ?? '').indexOf('·')
  return idx >= 0 ? name.slice(idx + 1).trim() : (name ?? '')
}

// 'YYYY-MM-DD' → 'M/D'
function toMD(dateStr) {
  const [, m, d] = (dateStr ?? '').split('-').map(Number)
  return m && d ? `${m}/${d}` : ''
}

export function periodRangeLabel(period) {
  return `${toMD(period.start_date)}~${toMD(period.end_date)}`
}

// 오늘이 속한 기간(우선순위 최고)을 고른다 — 백엔드 _load_period와 같은 규칙.
export function pickCurrentPeriod(periods, todayStr) {
  const containing = (periods ?? []).filter(
    (p) => p.start_date <= todayStr && todayStr <= p.end_date
  )
  if (!containing.length) return null
  return containing.reduce((a, b) => (b.priority > a.priority ? b : a))
}

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 기간 미리보기용 대표 날짜 — 기간 내 평일(월~금) 하루를 고른다.
 * 셔틀은 평일 시간표가 본체라, /shuttle/schedule?date=<이 값> 조회가
 * 그 기간의 평일 시간표를 돌려준다. 오늘이 기간 안이면 오늘부터,
 * 아니면 시작일부터 앞으로 스캔한다(전부 주말인 극단은 시작일 반환).
 */
export function representativeWeekday(period, todayStr) {
  const start = period.start_date
  const end = period.end_date
  let cursor = parseISO(todayStr >= start && todayStr <= end ? todayStr : start)
  const endDate = parseISO(end)
  while (cursor <= endDate) {
    const day = cursor.getDay()
    if (day >= 1 && day <= 5) return toISO(cursor)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  }
  return start
}

/**
 * 기간 칩에 보여줄 기간만 남긴다: 진행 중 + 미래 + 최근 종료(graceDays 이내).
 * 백엔드 /periods는 지난 45일까지 돌려주는데(방금 끝난 기간 참조용), 칩에는
 * 한참 지난 학기까지 나오면 소음이라 여기서 한 번 더 거른다.
 */
export function visiblePeriods(periods, todayStr, graceDays = 14) {
  const cutoff = (() => {
    const d = parseISO(todayStr)
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - graceDays))
  })()
  return (periods ?? []).filter((p) => p.end_date >= cutoff)
}

// 현재 데이터에 등장하는 variant 키 목록(범례 렌더용, 등장 순서 유지)
export function variantsInTimes(times) {
  const seen = []
  for (const t of times ?? []) {
    const v = typeof t === 'object' ? t?.variant : null
    if (v && PERIOD_VARIANTS[v] && !seen.includes(v)) seen.push(v)
  }
  return seen
}
