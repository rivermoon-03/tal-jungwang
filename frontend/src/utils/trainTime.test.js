import { describe, it, expect } from 'vitest'
import { formatRelAbs, nextTimetableSeconds } from './trainTime'

describe('formatRelAbs', () => {
  it('both values present → rel · abs', () => {
    expect(formatRelAbs(5, '10:25')).toBe('5분 뒤 · 10:25')
  })
  it('only minutes', () => {
    expect(formatRelAbs(5, null)).toBe('5분 뒤')
  })
  it('only hhmm', () => {
    expect(formatRelAbs(null, '10:25')).toBe('10:25')
  })
  it('neither', () => {
    expect(formatRelAbs(null, null)).toBe('—')
  })
  it('NaN minutes falls back to hhmm', () => {
    expect(formatRelAbs(Number.NaN, '10:25')).toBe('10:25')
  })
  it('empty string hhmm treated as missing', () => {
    expect(formatRelAbs(3, '')).toBe('3분 뒤')
  })
})

describe('nextTimetableSeconds', () => {
  it('returns null for empty list', () => {
    expect(nextTimetableSeconds([])).toBeNull()
    expect(nextTimetableSeconds(null)).toBeNull()
  })

  it('picks the next future depart_at', () => {
    const now = new Date('2026-05-16T10:00:00')
    const trains = [
      { depart_at: '09:55' },  // past
      { depart_at: '10:05' },  // +5min = 300s
      { depart_at: '10:20' },
    ]
    const seconds = nextTimetableSeconds(trains, now)
    expect(seconds).toBe(5 * 60)
  })

  it('returns null when all trains in past', () => {
    const now = new Date('2026-05-16T23:00:00')
    const trains = [
      { depart_at: '08:00' },
      { depart_at: '12:00' },
      { depart_at: '22:00' },
    ]
    expect(nextTimetableSeconds(trains, now)).toBeNull()
  })

  it('handles midnight rollover (00:30 train from 23:55)', () => {
    const now = new Date('2026-05-16T23:55:00')
    const trains = [
      { depart_at: '00:30' },  // 35min later = next day
    ]
    expect(nextTimetableSeconds(trains, now)).toBe(35 * 60)
  })

  it('skips invalid entries', () => {
    const now = new Date('2026-05-16T10:00:00')
    const trains = [
      { depart_at: 'invalid' },
      { depart_at: '10:10' },
    ]
    expect(nextTimetableSeconds(trains, now)).toBe(10 * 60)
  })
})
