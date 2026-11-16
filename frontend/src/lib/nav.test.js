import { it, expect } from 'vitest'
import { transitionKind } from './nav'

it('경로 깊이로 전환 종류를 정한다', () => {
  expect(transitionKind(null, '/')).toBe(null)
  expect(transitionKind('/', '/transit')).toBe('tab')
  expect(transitionKind('/transit', '/transit/bus/20-1')).toBe('push')
  expect(transitionKind('/transit/bus/20-1', '/transit')).toBe('pop')
  expect(transitionKind('/cafeteria', '/cafeteria/gs25')).toBe('push')
  expect(transitionKind('/transit/bus/20-1', '/transit/subway/timetable')).toBe('tab')
})
