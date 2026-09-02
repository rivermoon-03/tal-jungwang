import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './relativeTime'

const NOW = new Date('2026-09-01T12:00:00+09:00')

describe('formatRelativeTime', () => {
  it('입력이 없으면 빈 문자열이다', () => {
    expect(formatRelativeTime(null, NOW)).toBe('')
    expect(formatRelativeTime(undefined, NOW)).toBe('')
  })

  it('파싱할 수 없는 값이면 빈 문자열이다', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('')
  })

  it('1분 미만이면 방금 전이다', () => {
    const d = new Date(NOW.getTime() - 30_000)
    expect(formatRelativeTime(d, NOW)).toBe('방금 전')
  })

  it('60분 미만이면 N분 전이다', () => {
    const d = new Date(NOW.getTime() - 5 * 60_000)
    expect(formatRelativeTime(d, NOW)).toBe('5분 전')
  })

  it('24시간 미만이면 N시간 전이다', () => {
    const d = new Date(NOW.getTime() - 3 * 3_600_000)
    expect(formatRelativeTime(d, NOW)).toBe('3시간 전')
  })

  it('7일 미만이면 N일 전이다', () => {
    const d = new Date(NOW.getTime() - 2 * 86_400_000)
    expect(formatRelativeTime(d, NOW)).toBe('2일 전')
  })

  it('7일 이상이면 월/일 날짜로 표시한다', () => {
    const d = new Date('2026-08-01T12:00:00+09:00')
    expect(formatRelativeTime(d, NOW)).toMatch(/8월 1일/)
  })
})
