import { describe, it, expect } from 'vitest'
import { normalizeMenuItems } from './mealMenu'

// 결함 #9 — 학교 원본(xlsx)의 별표 메타 표기("*복수메뉴*" 등)가 메뉴 이름인 척
// 홈 브리핑과 학식 태그 화면에 그대로 찍혔다. normalizeMenuItems가 두 화면이
// 공유하는 단 하나의 정규화 지점이다(HomeBriefing/homeBriefing.js,
// MealGridSection.jsx 양쪽이 이 함수를 쓴다).
describe('normalizeMenuItems', () => {
  it('별표로 감싼 메타 표기를 걷어낸다', () => {
    expect(normalizeMenuItems(['*복수메뉴*', '에비동/제육볶음면', '무채국']))
      .toEqual(['에비동/제육볶음면', '무채국'])
  })

  it('메타 표기가 없으면 그대로 반환한다', () => {
    expect(normalizeMenuItems(['비빔밥', '된장찌개'])).toEqual(['비빔밥', '된장찌개'])
  })

  it('별표가 앞뒤에 온전히 감싸지 않은 항목은 그대로 둔다(예: 메뉴 이름에 * 포함)', () => {
    expect(normalizeMenuItems(['고구마*튀김'])).toEqual(['고구마*튀김'])
  })

  it('null/undefined 배열은 빈 배열로 반환한다', () => {
    expect(normalizeMenuItems(null)).toEqual([])
    expect(normalizeMenuItems(undefined)).toEqual([])
  })

  it('빈 문자열/falsy 항목도 함께 걷어낸다', () => {
    expect(normalizeMenuItems(['비빔밥', '', null, '김치'])).toEqual(['비빔밥', '김치'])
  })
})
