import { describe, it, expect } from 'vitest'
import { realtimeSecToMinutes } from './busArrivalDisplay'

describe('realtimeSecToMinutes', () => {
  it('ceils 60s to 1m', () => {
    expect(realtimeSecToMinutes(60)).toBe(1)
  })

  it('ceils 61s to 2m', () => {
    expect(realtimeSecToMinutes(61)).toBe(2)
  })

  it('ceils 120s to 2m', () => {
    expect(realtimeSecToMinutes(120)).toBe(2)
  })

  it('ceils 240s to 4m', () => {
    expect(realtimeSecToMinutes(240)).toBe(4)
  })

  it('ceils 270s to 5m (matches BusEtaCard formatEta ceil)', () => {
    expect(realtimeSecToMinutes(270)).toBe(5)
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
