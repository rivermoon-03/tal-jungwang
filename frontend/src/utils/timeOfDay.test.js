import { describe, it, expect } from 'vitest'
import { getKstHour, getTimeOfDay } from './timeOfDay'

// UTC 시각을 넣으면 KST(UTC+9)로 변환되어야 한다.
// 예) UTC 09:00 == KST 18:00

describe('getKstHour', () => {
  it('UTC 자정을 KST 오전 9시로 변환한다', () => {
    expect(getKstHour(new Date('2026-07-17T00:00:00Z'))).toBe(9)
  })

  it('UTC 15:00을 KST 자정(0시)으로 변환한다(익일)', () => {
    expect(getKstHour(new Date('2026-07-17T15:00:00Z'))).toBe(0)
  })
})

describe('getTimeOfDay', () => {
  it('KST 06:00은 day 밴드 시작이다', () => {
    // KST 06:00 == UTC 전날 21:00
    expect(getTimeOfDay(new Date('2026-07-16T21:00:00Z'))).toBe('day')
  })

  it('KST 16:59는 day다', () => {
    expect(getTimeOfDay(new Date('2026-07-17T07:59:00Z'))).toBe('day')
  })

  it('KST 17:00은 evening 밴드 시작이다', () => {
    expect(getTimeOfDay(new Date('2026-07-17T08:00:00Z'))).toBe('evening')
  })

  it('KST 19:59는 evening이다', () => {
    expect(getTimeOfDay(new Date('2026-07-17T10:59:00Z'))).toBe('evening')
  })

  it('KST 20:00은 night 밴드 시작이다', () => {
    expect(getTimeOfDay(new Date('2026-07-17T11:00:00Z'))).toBe('night')
  })

  it('KST 05:59는 night(자정 넘김)이다', () => {
    // KST 05:59 == UTC 전날 20:59
    expect(getTimeOfDay(new Date('2026-07-16T20:59:00Z'))).toBe('night')
  })

  it('KST 자정(00:00)은 night다', () => {
    // KST 00:00 == UTC 전날 15:00
    expect(getTimeOfDay(new Date('2026-07-16T15:00:00Z'))).toBe('night')
  })
})
