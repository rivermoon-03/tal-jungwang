/**
 * homeBriefing — 홈 브리핑(F1) 표시용 순수 헬퍼.
 * 컴포넌트 파일(HomeBriefing.jsx)은 컴포넌트만 export해야 Fast Refresh가 동작해
 * (react-refresh/only-export-components) 요약 로직을 여기로 분리했다.
 */
import { extractDayKeys, getTodayDayKey, isMenuWeekStale } from './cafeteriaDays'

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
