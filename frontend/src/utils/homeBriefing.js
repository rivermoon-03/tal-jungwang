/**
 * homeBriefing — 홈 브리핑(F1) 표시용 순수 헬퍼.
 * 컴포넌트 파일(HomeBriefing.jsx)은 컴포넌트만 export해야 Fast Refresh가 동작해
 * (react-refresh/only-export-components) 요약 로직을 여기로 분리했다.
 */
import { extractDayKeys, getTodayDayKey, isMenuWeekStale } from './cafeteriaDays'
import { ddayFrom } from './academicCalendar'

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
  const dayKeys = extractDayKeys(cafeteria)
  if (isMenuWeekStale(data?.week_start, data?.year, dayKeys)) return null
  const todayKey = getTodayDayKey(data?.week_start, data?.year, dayKeys)
  if (!todayKey) return null

  const meal =
    cafeteria.meals.find((m) => (m.type ?? '').includes('중식')) ?? cafeteria.meals[0]
  const items = (meal?.by_day?.[todayKey] ?? []).filter(Boolean)
  if (!items.length) return null
  const head = items[0]
  return items.length > 1 ? `${meal.type} · ${head} 외 ${items.length - 1}` : `${meal.type} · ${head}`
}
