import { describe, it, expect } from 'vitest'
import { mealKindOf, currentMealKind, pickMeal, mealStatus, venueIdOf } from './mealSelect'

it('끼니 이름을 조식, 중식, 석식으로 맞춘다', () => {
  expect(mealKindOf('천원의 아침밥')).toBe('조식')
  expect(mealKindOf('중식')).toBe('중식')
  expect(mealKindOf('석식')).toBe('석식')
  expect(mealKindOf('간식')).toBe(null)
})

it('시각으로 지금 끼니를 고른다', () => {
  expect(currentMealKind(8 * 60)).toBe('조식')
  expect(currentMealKind(12 * 60)).toBe('중식')
  expect(currentMealKind(18 * 60)).toBe('석식')
})

it('식당 이름으로 venue id 를 찾는다', () => {
  expect(venueIdOf('TIP 학생식당')).toBe('student-cafeteria')
  expect(venueIdOf('E동 레스토랑')).toBe('e-restaurant')
})

describe('pickMeal', () => {
  const section = { meals: [{ type: '중식', time: '11:00~14:00', by_day: { 17: ['제육볶음', '*복수메뉴*'], 18: ['미운영'] } }] }
  it('메타 표기를 걷고 메뉴를 돌려준다', () => {
    expect(pickMeal(section, '중식', '17')).toEqual({ time: '11:00~14:00', items: ['제육볶음'], closed: false })
  })
  it('미운영은 closed', () => {
    expect(pickMeal(section, '중식', '18')).toMatchObject({ items: [], closed: true })
  })
  it('해당 끼니가 없으면 null', () => {
    expect(pickMeal(section, '석식', '17')).toBe(null)
  })
})

describe('mealStatus', () => {
  it('시간대별 상태', () => {
    expect(mealStatus('11:00~14:00', 10 * 60, true)).toEqual({ kind: 'closed', text: '11:00 부터' })
    expect(mealStatus('11:00~14:00', 12 * 60, true)).toEqual({ kind: 'open', text: '운영 중  14:00 까지' })
    expect(mealStatus('11:00~14:00', 13 * 60 + 45, true).kind).toBe('soon')
    expect(mealStatus('11:00~14:00', 15 * 60, true).text).toBe('마감')
  })
  it('오늘이 아니면 시간만', () => {
    expect(mealStatus('11:00~14:00', 12 * 60, false).text).toBe('11:00 ~ 14:00')
  })
})
