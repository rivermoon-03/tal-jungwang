import { describe, it, expect } from 'vitest'
import { formatEta } from './eta'
describe('formatEta', () => {
  it('null이면 정보 없음/none', () => {
    expect(formatEta(null)).toEqual({ text: '운행 정보 없음', tone: 'none' })
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
})
