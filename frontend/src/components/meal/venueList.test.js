import { it, expect } from 'vitest'
import { pillKindOf, venuesByCategory, openCount } from './venueList'

it('영업 상태를 칩 종류로 바꾼다', () => {
  expect(pillKindOf('open')).toBe('open')
  expect(pillKindOf('always')).toBe('open')
  expect(pillKindOf('closing')).toBe('soon')
  expect(pillKindOf('before_open')).toBe('soon')
  expect(pillKindOf('after_close')).toBe('closed')
  expect(pillKindOf('closed_day')).toBe('closed')
})

it('지금 열린 곳 보기는 전체보다 많지 않고, 영업 중인 곳이 앞에 온다', () => {
  // 학기 중 평일 낮(화요일 12:30 KST)
  const now = new Date('2026-11-17T03:30:00Z')
  const all = venuesByCategory(now, false)
  const open = venuesByCategory(now, true)
  const total = (gs) => gs.reduce((n, g) => n + g.rows.length, 0)
  expect(total(open)).toBeLessThanOrEqual(total(all))
  expect(openCount(open)).toBe(openCount(all))
  for (const g of all) {
    const firstClosed = g.rows.findIndex((r) => !r.state.open)
    if (firstClosed >= 0) expect(g.rows.slice(firstClosed).every((r) => !r.state.open)).toBe(true)
  }
})
