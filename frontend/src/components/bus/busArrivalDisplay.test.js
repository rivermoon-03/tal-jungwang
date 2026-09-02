import { describe, it, expect } from 'vitest'
import { realtimeSecToMinutes } from './busArrivalDisplay'

describe('realtimeSecToMinutes', () => {
  it('floors 60s to 1m', () => {
    expect(realtimeSecToMinutes(60)).toBe(1)
  })

  it('floors 61s to 1m', () => {
    expect(realtimeSecToMinutes(61)).toBe(1)
  })

  it('floors 120s to 2m', () => {
    expect(realtimeSecToMinutes(120)).toBe(2)
  })

  it('floors 240s to 4m', () => {
    expect(realtimeSecToMinutes(240)).toBe(4)
  })

  it('floors 270s to 4m (matches eta.js formatEta floor)', () => {
    expect(realtimeSecToMinutes(270)).toBe(4)
  })

  it('returns 0 for values <= 0 (caller handles IMMINENT)', () => {
    expect(realtimeSecToMinutes(0)).toBe(0)
  })

  it('handles null/undefined as 0', () => {
    expect(realtimeSecToMinutes(null)).toBe(0)
    expect(realtimeSecToMinutes(undefined)).toBe(0)
  })

  it('clamps negative to 0', () => {
    expect(realtimeSecToMinutes(-10)).toBe(0)
  })
})
