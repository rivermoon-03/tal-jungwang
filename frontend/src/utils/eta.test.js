import { describe, it, expect } from 'vitest'
import { formatEta, isImminent, IMMINENT_THRESHOLD_SEC } from './eta'

describe('formatEta', () => {
  it('null이면 정보 없음/none', () => {
    expect(formatEta(null)).toEqual({ text: '운행 정보 없음', tone: 'none' })
  })
  it('undefined이면 정보 없음/none', () => {
    expect(formatEta(undefined)).toEqual({ text: '운행 정보 없음', tone: 'none' })
  })
  it('90초 이하는 곧 도착/imminent', () => {
    expect(formatEta(60)).toEqual({ text: '곧 도착', tone: 'imminent' })
  })
  it('239초는 3분(floor)/normal', () => {
    expect(formatEta(239)).toEqual({ text: '3분', tone: 'normal' })
  })
  it('departAt 있으면 "N분 뒤 · HH:MM"', () => {
    const now = 0
    const departAt = 3 * 60 * 1000 + 239 * 1000 // 임의
    const r = formatEta(239, { now, departAt })
    expect(r.tone).toBe('normal')
    expect(r.text).toMatch(/^3분 뒤 · \d{2}:\d{2}$/)
  })

  // ── 경계값 ──────────────────────────────────────────────────────────
  describe('경계값', () => {
    it('0초는 곧 도착/imminent', () => {
      expect(formatEta(0)).toEqual({ text: '곧 도착', tone: 'imminent' })
    })

    it('음수는 곧 도착/imminent (formatEta 자체에는 "이미 도착" 개념이 없다)', () => {
      expect(formatEta(-10)).toEqual({ text: '곧 도착', tone: 'imminent' })
    })

    it('임계 직전(89초)은 곧 도착/imminent', () => {
      expect(formatEta(89)).toEqual({ text: '곧 도착', tone: 'imminent' })
    })

    it('정확히 임계(90초)는 곧 도착/imminent', () => {
      expect(formatEta(IMMINENT_THRESHOLD_SEC)).toEqual({ text: '곧 도착', tone: 'imminent' })
    })

    it('임계 직후(91초)는 1분/normal', () => {
      expect(formatEta(91)).toEqual({ text: '1분', tone: 'normal' })
    })

    it('정확히 60분(3600초)은 상대시간 "60분"', () => {
      expect(formatEta(3600)).toEqual({ text: '60분', tone: 'normal' })
    })

    it('60분 초과(3661초, floor로 61분)는 절대시각(HH:MM)으로 전환', () => {
      const now = new Date('2026-09-01T09:00:00+09:00').getTime()
      const r = formatEta(3661, { now })
      // 3661초 뒤 = 09:00:00 + 61분 1초 = 10:01:01 → KST "10:01"
      expect(r.tone).toBe('normal')
      expect(r.text).toBe('10:01')
    })

    it('60분 초과는 KST 기준 HH:MM 형식이다', () => {
      const now = new Date('2026-09-01T23:30:00+09:00').getTime()
      const r = formatEta(90 * 60, { now }) // 90분 뒤
      expect(r.text).toBe('01:00')
    })
  })
})

describe('isImminent', () => {
  it('null/undefined는 false', () => {
    expect(isImminent(null)).toBe(false)
    expect(isImminent(undefined)).toBe(false)
  })

  it('임계(90초) 이하는 true', () => {
    expect(isImminent(0)).toBe(true)
    expect(isImminent(-5)).toBe(true)
    expect(isImminent(89)).toBe(true)
    expect(isImminent(IMMINENT_THRESHOLD_SEC)).toBe(true)
  })

  it('임계 초과는 false', () => {
    expect(isImminent(91)).toBe(false)
    expect(isImminent(180)).toBe(false)
  })

  it('formatEta의 곧 도착 판정과 항상 같은 값을 낸다', () => {
    for (const sec of [-10, 0, 1, 89, 90, 91, 120, 179, 180, 181, 3600, 3601]) {
      expect(formatEta(sec).tone === 'imminent').toBe(isImminent(sec))
    }
  })
})
