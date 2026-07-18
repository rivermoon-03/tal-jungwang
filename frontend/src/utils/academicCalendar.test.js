import { describe, it, expect } from 'vitest'
import { ddayFrom, formatDday, formatDateOrRange } from './academicCalendar'

// 기준 "오늘" — Asia/Seoul 정오로 고정(자정 경계 흔들림 방지).
const NOW = new Date('2026-07-18T03:00:00Z') // KST 2026-07-18 12:00

describe('ddayFrom / formatDday', () => {
  it('미래 날짜는 양수 D-day', () => {
    expect(ddayFrom('2026-07-23', NOW)).toBe(5)
    expect(formatDday('2026-07-23', NOW)).toBe('D-5')
  })

  it('오늘 날짜는 D-DAY', () => {
    expect(ddayFrom('2026-07-18', NOW)).toBe(0)
    expect(formatDday('2026-07-18', NOW)).toBe('D-DAY')
  })

  it('지난 날짜는 D+N', () => {
    expect(ddayFrom('2026-07-10', NOW)).toBe(-8)
    expect(formatDday('2026-07-10', NOW)).toBe('D+8')
  })

  it('startDate가 없으면 null / 빈 문자열', () => {
    expect(ddayFrom(null, NOW)).toBeNull()
    expect(formatDday(undefined, NOW)).toBe('')
  })

  it('자정 근처 UTC 시각이어도 KST 기준 날짜로 계산한다', () => {
    // 2026-07-18 08:59:59 UTC = 2026-07-18 17:59:59 KST → 여전히 7/18
    const nearMidnightUtc = new Date('2026-07-18T08:59:59Z')
    expect(ddayFrom('2026-07-19', nearMidnightUtc)).toBe(1)
    // 2026-07-17 15:00:01 UTC = 2026-07-18 00:00:01 KST → 이미 7/18로 넘어감
    const justAfterKstMidnight = new Date('2026-07-17T15:00:01Z')
    expect(ddayFrom('2026-07-18', justAfterKstMidnight)).toBe(0)
  })
})

describe('formatDateOrRange', () => {
  it('start === end면 단일 날짜', () => {
    expect(formatDateOrRange('2026-06-23', '2026-06-23')).toBe('6월 23일')
  })

  it('end가 없으면 단일 날짜', () => {
    expect(formatDateOrRange('2026-09-01', null)).toBe('9월 1일')
  })

  it('start !== end면 범위 표시', () => {
    expect(formatDateOrRange('2026-06-09', '2026-06-22')).toBe('6월 9일 ~ 6월 22일')
  })

  it('startDate가 없으면 빈 문자열', () => {
    expect(formatDateOrRange(null, '2026-06-22')).toBe('')
  })
})
