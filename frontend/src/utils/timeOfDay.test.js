import { describe, it, expect } from 'vitest'
import { getKstHour, getTimeOfDay, getKstDayOfWeek, getKstHourMinuteLabel } from './timeOfDay'

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

describe('getKstDayOfWeek', () => {
  it('UTC 금요일 15:30(KST 토요일 00:30)은 KST 기준 토요일(6)이다 — 날짜가 넘어가는 경계값', () => {
    // 2026-07-17은 금요일. UTC 15:30 == KST 익일(2026-07-18, 토) 00:30.
    // Date.getDay()를 직접 썼다면(로컬이 UTC 근처인 환경) 여기서 금요일(5)로 잘못 나온다.
    expect(getKstDayOfWeek(new Date('2026-07-17T15:30:00Z'))).toBe(6)
  })

  it('평일(KST 기준 화요일)은 2를 반환한다', () => {
    // KST 2026-07-21(화) 12:00 == UTC 03:00
    expect(getKstDayOfWeek(new Date('2026-07-21T03:00:00Z'))).toBe(2)
  })
})

describe('getKstHourMinuteLabel', () => {
  it('KST HH:MM 형식으로 포맷한다', () => {
    // UTC 09:00 == KST 18:00
    expect(getKstHourMinuteLabel(new Date('2026-07-17T09:00:00Z'))).toBe('18:00')
  })

  it('자정을 24:00이 아닌 00:00으로 표기한다', () => {
    // UTC 15:00 == KST 익일 00:00
    expect(getKstHourMinuteLabel(new Date('2026-07-17T15:00:00Z'))).toBe('00:00')
  })
})
