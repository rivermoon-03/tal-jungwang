/**
 * homeBriefing — 홈 브리핑(F1) 표시용 순수 헬퍼.
 * 컴포넌트 파일(HomeBriefing.jsx)은 컴포넌트만 export해야 Fast Refresh가 동작해
 * (react-refresh/only-export-components) 요약 로직을 여기로 분리했다.
 */
import { extractDayKeys, getTodayDayKey, isMenuWeekStale } from './cafeteriaDays'
import { ddayFrom } from './academicCalendar'
import { normalizeMenuItems } from '../components/cafeteria/mealMenu'

// ── 도서관 열람실 "지금 열려 있나" 요약 ────────────────────────────────
// 원본 문자열은 "[방학] 평일 09:30 ~ 17:30" / "매일 06:30 ~ 23:00" / "미개방" 꼴.
// 시험기간에만 보이던 개관시간을 홈에서 상시로 답해주기 위한 헬퍼.
const HOURS_RE = /(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/

function scopeMatchesToday(hours, day) {
  // day: 0=일 … 6=토
  if (/매일/.test(hours)) return true
  if (/평일/.test(hours)) return day >= 1 && day <= 5
  if (/토/.test(hours)) return day === 6
  if (/일/.test(hours)) return day === 0
  return true // 요일 표기가 없으면 오늘 적용으로 본다
}

function toMinutes(h, m) {
  return h * 60 + m
}

/**
 * 열람실 한 곳의 오늘 상태.
 * @returns {{state: 'open'|'closed'|'off', startText?: string, endText?: string,
 *            start?: number, end?: number}}
 *   off  = 오늘 운영 자체가 없음(미개방이거나 오늘 요일 대상이 아님)
 *   open = 지금 열려 있음 / closed = 오늘 운영하지만 지금은 닫힘
 */
export function roomStateToday(room, now = new Date()) {
  if (!room?.hours || room.closed) return { state: 'off' }
  const m = HOURS_RE.exec(room.hours)
  if (!m || !scopeMatchesToday(room.hours, now.getDay())) return { state: 'off' }

  const start = toMinutes(Number(m[1]), Number(m[2]))
  const end = toMinutes(Number(m[3]), Number(m[4]))
  const nowMin = toMinutes(now.getHours(), now.getMinutes())
  return {
    state: nowMin >= start && nowMin < end ? 'open' : 'closed',
    start,
    end,
    startText: `${m[1].padStart(2, '0')}:${m[2]}`,
    endText: `${m[3].padStart(2, '0')}:${m[4]}`,
  }
}

/**
 * @returns {{open: boolean, label: string, sub: string}|null}
 *   열람실 정보가 없으면 null(행 자체를 그리지 않는다).
 */
export function summarizeLibraryHours(rooms, now = new Date()) {
  if (!Array.isArray(rooms) || rooms.length === 0) return null
  const nowMin = toMinutes(now.getHours(), now.getMinutes())

  const parsed = []
  for (const r of rooms) {
    const s = roomStateToday(r, now)
    if (s.state === 'off') continue
    parsed.push({ room: r.room, ...s })
  }
  if (!parsed.length) return { open: false, label: '오늘은 열람실을 열지 않아요', sub: '도서관 안내 보기' }

  const openNow = parsed.filter((p) => nowMin >= p.start && nowMin < p.end)
  if (openNow.length) {
    // 가장 늦게까지 여는 곳이 "언제까지 있을 수 있나"의 답이다
    const latest = openNow.reduce((a, b) => (b.end > a.end ? b : a))
    return {
      open: true,
      label: `지금 ${openNow.length}곳 열림`,
      sub: `${latest.room} ${latest.endText}까지`,
    }
  }

  const upcoming = parsed.filter((p) => p.start > nowMin).sort((a, b) => a.start - b.start)[0]
  return {
    open: false,
    label: '지금은 모두 닫혀 있어요',
    sub: upcoming ? `${upcoming.room} ${upcoming.startText} 개방` : '오늘 운영 종료',
  }
}

// F7 — 학사일정에서 시험기간(중간·기말고사)을 찾는다.
// 진행 중이거나 시작 7일 전 이내일 때만 반환 — 그 밖엔 카드 자체가 없다.
export function findExamEvent(events, now = new Date()) {
  for (const ev of events ?? []) {
    if (!ev?.title || !/고사/.test(ev.title)) continue
    const dday = ddayFrom(ev.start_date, now)
    const end = ev.end_date ?? ev.start_date
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const ongoing = ev.start_date <= todayIso && todayIso <= end
    if (ongoing || (dday != null && dday >= 0 && dday <= 7)) return ev
  }
  return null
}

// 오늘 학식 요약 문자열 — TIP 학생식당의 중식 우선, 없으면 첫 끼니.
// 지난주 식단(스테일)이면 오늘 메뉴가 아니므로 null.
export function summarizeTodayMenu(data) {
  const cafeteria = data?.cafeterias?.[0]
  if (!cafeteria?.meals?.length) return null
  const dayKeys = extractDayKeys(cafeteria, data?.week_start, data?.year)
  if (isMenuWeekStale(data?.week_start, data?.year, dayKeys)) return null
  const todayKey = getTodayDayKey(data?.week_start, data?.year, dayKeys)
  if (!todayKey) return null

  const meal =
    cafeteria.meals.find((m) => (m.type ?? '').includes('중식')) ?? cafeteria.meals[0]
  // 별표 메타 표기("*복수메뉴*" 등)는 메뉴 이름이 아니라 학교 쪽 안내문이다.
  // MealGridSection과 같은 normalizeMenuItems를 써야 브리핑 한 줄에 별표
  // 마크업이 그대로 찍히는 결함이 재발하지 않는다.
  const items = normalizeMenuItems(meal?.by_day?.[todayKey])
  if (!items.length) return null
  const head = items[0]
  return items.length > 1 ? `${meal.type} · ${head} 외 ${items.length - 1}` : `${meal.type} · ${head}`
}
