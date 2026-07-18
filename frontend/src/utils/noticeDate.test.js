import { describe, it, expect } from 'vitest'
import { formatFullDate } from './noticeDate'

describe('formatFullDate', () => {
  it('ISO 문자열을 "YYYY년 M월 D일" 형식으로 변환한다', () => {
    expect(formatFullDate('2026-07-16T00:00:00+09:00')).toBe('2026년 7월 16일')
  })

  it('빈 값이면 빈 문자열', () => {
    expect(formatFullDate(null)).toBe('')
    expect(formatFullDate(undefined)).toBe('')
    expect(formatFullDate('')).toBe('')
  })

  it('잘못된 날짜 문자열이면 빈 문자열', () => {
    expect(formatFullDate('not-a-date')).toBe('')
  })
})
