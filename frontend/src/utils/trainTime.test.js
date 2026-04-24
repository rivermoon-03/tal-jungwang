import { describe, it, expect } from 'vitest'
import { formatRelAbs } from './trainTime'

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
