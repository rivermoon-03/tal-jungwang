import { normalizeMenuItems, isEmptyMenu, parseMealTimeRange } from '../cafeteria/mealMenu'
import { clockToMinutes } from '../transit/format'

export const MEAL_KINDS = ['조식', '중식', '석식']

/** 원본 끼니 이름("천원의 아침밥" 등) → 조식, 중식, 석식 */
export function mealKindOf(type) {
  if (!type) return null
  if (type.includes('조식') || type.includes('아침')) return '조식'
  if (type.includes('중식') || type.includes('점심')) return '중식'
  if (type.includes('석식') || type.includes('저녁')) return '석식'
  return null
}

/** 지금 시각에 맞는 끼니 */
export function currentMealKind(nowMin) {
  if (nowMin < 10 * 60) return '조식'
  if (nowMin < 15 * 60) return '중식'
  return '석식'
}

/** 식당 이름 → cafeteriaVenues 의 id */
export function venueIdOf(sectionName) {
  if (sectionName?.includes('학생식당')) return 'student-cafeteria'
  if (sectionName?.includes('E동')) return 'e-restaurant'
  return null
}

/** 한 식당의 그날 그 끼니 메뉴 */
export function pickMeal(section, kind, dayKey) {
  const meal = section?.meals?.find((m) => mealKindOf(m.type) === kind)
  if (!meal) return null
  const items = normalizeMenuItems(meal.by_day?.[dayKey])
  return { time: meal.time ?? null, items: isEmptyMenu(items) ? [] : items, closed: items.length === 1 && items[0] === '미운영' }
}

/** 운영 상태 칩. 오늘이 아니면 시간만 보여준다. */
export function mealStatus(time, nowMin, isToday) {
  const range = parseMealTimeRange(time)
  if (!range) return null
  const [s, e] = range.map(clockToMinutes)
  if (!isToday) return { kind: 'closed', text: `${range[0]} ~ ${range[1]}` }
  if (nowMin < s) return { kind: 'closed', text: `${range[0]} 부터` }
  if (nowMin >= e) return { kind: 'closed', text: '마감' }
  if (e - nowMin <= 20) return { kind: 'soon', text: `곧 마감  ${range[1]}` }
  return { kind: 'open', text: `운영 중  ${range[1]} 까지` }
}
