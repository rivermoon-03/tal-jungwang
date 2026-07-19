import { describe, it, expect } from 'vitest'
import { metersToWalkMinutes, WALK_METERS_PER_MINUTE } from './walkEstimate'

describe('metersToWalkMinutes', () => {
  it('null/undefined는 null을 반환한다', () => {
    expect(metersToWalkMinutes(null)).toBeNull()
    expect(metersToWalkMinutes(undefined)).toBeNull()
  })

  it('NaN은 null을 반환한다', () => {
    expect(metersToWalkMinutes(NaN)).toBeNull()
  })

  it('0m 이하는 0분', () => {
    expect(metersToWalkMinutes(0)).toBe(0)
    expect(metersToWalkMinutes(-10)).toBe(0)
  })

  it('짧은 거리도 최소 1분으로 올림한다 (0분 오해 방지)', () => {
    expect(metersToWalkMinutes(1)).toBe(1)
    expect(metersToWalkMinutes(40)).toBe(1)
  })

  it(`정확히 ${WALK_METERS_PER_MINUTE}m는 1분`, () => {
    expect(metersToWalkMinutes(WALK_METERS_PER_MINUTE)).toBe(1)
  })

  it(`${WALK_METERS_PER_MINUTE}m를 살짝 넘으면 2분으로 올림한다`, () => {
    expect(metersToWalkMinutes(WALK_METERS_PER_MINUTE + 1)).toBe(2)
  })

  it('800m는 10분', () => {
    expect(metersToWalkMinutes(800)).toBe(10)
  })
})
