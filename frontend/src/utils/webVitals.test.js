import { it, expect } from 'vitest'
import { pageOf } from './webVitals'

it('경로를 백엔드가 받는 페이지 라벨로 줄인다', () => {
  expect(pageOf('/')).toBe('home')
  expect(pageOf('/transit/bus/20-1')).toBe('transit')
  expect(pageOf('/cafeteria/student-cafeteria')).toBe('cafeteria')
  expect(pageOf('/more/settings')).toBe('more')
  expect(pageOf('/privacy')).toBe('other')
})
