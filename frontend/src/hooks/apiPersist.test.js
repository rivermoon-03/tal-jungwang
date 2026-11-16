import { describe, it, expect, beforeEach } from 'vitest'
import { readPersisted, writePersisted, maxAgeOf } from './apiPersist'

describe('apiPersist', () => {
  beforeEach(() => localStorage.clear())

  it('허용한 경로만 보관한다', () => {
    writePersisted('/notices', { a: 1 }, 1000)
    expect(localStorage.length).toBe(0)
    expect(maxAgeOf('/bus/arrivals/224000639')).toBe(180_000)
  })

  it('보관 한도 안이면 돌려주고 지나면 null', () => {
    writePersisted('/bus/arrivals/1', { x: 1 }, 1_000_000)
    expect(readPersisted('/bus/arrivals/1', 1_000_000 + 60_000)).toEqual({ data: { x: 1 }, fetchedAt: 1_000_000 })
    expect(readPersisted('/bus/arrivals/1', 1_000_000 + 181_000)).toBe(null)
  })

  it('깨진 값은 무시한다', () => {
    localStorage.setItem('tj-api:/weather/current', '{oops')
    expect(readPersisted('/weather/current')).toBe(null)
  })
})
