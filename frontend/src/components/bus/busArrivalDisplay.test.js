import { describe, it, expect } from 'vitest'
import { realtimeSecToMinutes } from './busArrivalDisplay'

describe('realtimeSecToMinutes', () => {
  it('floors 60s to 1m', () => {
    expect(realtimeSecToMinutes(60)).toBe(1)
  })

  it('floors 119s to 1m (not 2m)', () => {
    expect(realtimeSecToMinutes(119)).toBe(1)
  })

  it('floors 239s to 3m (not 4m) — 핵심 보수 케이스', () => {
    expect(realtimeSecToMinutes(239)).toBe(3)
  })

  it('floors 240s to 4m', () => {
    expect(realtimeSecToMinutes(240)).toBe(4)
  })

  it('returns 0 for values under 60s', () => {
    expect(realtimeSecToMinutes(0)).toBe(0)
    expect(realtimeSecToMinutes(30)).toBe(0)
    expect(realtimeSecToMinutes(59)).toBe(0)
  })

  it('handles null/undefined as 0', () => {
    expect(realtimeSecToMinutes(null)).toBe(0)
    expect(realtimeSecToMinutes(undefined)).toBe(0)
  })

  it('clamps negative to 0', () => {
    expect(realtimeSecToMinutes(-10)).toBe(0)
  })
})
