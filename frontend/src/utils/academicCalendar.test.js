import { describe, it, expect } from 'vitest'
import {
  ddayFrom,
  formatDday,
  formatDateOrRange,
  dateStringFrom,
  daysInMonth,
  firstWeekdayOfMonth,
  shiftMonth,
  monthLabel,
  buildMonthGrid,
  isDateInRange,
} from './academicCalendar'

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

describe('dateStringFrom', () => {
  it('한 자리 월/일도 zero-pad한다', () => {
    expect(dateStringFrom(2026, 7, 9)).toBe('2026-07-09')
    expect(dateStringFrom(2026, 12, 31)).toBe('2026-12-31')
  })
})

describe('daysInMonth', () => {
  it('31일까지 있는 달', () => {
    expect(daysInMonth(2026, 7)).toBe(31)
  })

  it('30일까지 있는 달', () => {
    expect(daysInMonth(2026, 9)).toBe(30)
  })

  it('평년 2월은 28일', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
  })

  it('윤년 2월은 29일', () => {
    expect(daysInMonth(2028, 2)).toBe(29)
  })
})

describe('firstWeekdayOfMonth', () => {
  it('2026년 7월 1일은 수요일(3)', () => {
    expect(firstWeekdayOfMonth(2026, 7)).toBe(3)
  })
})

describe('shiftMonth', () => {
  it('같은 해 안에서 이동', () => {
    expect(shiftMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 })
    expect(shiftMonth(2026, 7, -1)).toEqual({ year: 2026, month: 6 })
  })

  it('연말/연초를 넘어가는 이동', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('monthLabel', () => {
  it('"YYYY년 M월" 형식', () => {
    expect(monthLabel(2026, 7)).toBe('2026년 7월')
  })
})

describe('buildMonthGrid', () => {
  it('길이는 항상 7의 배수이고 날짜 셀 수는 해당 월의 일수와 같다', () => {
    const grid = buildMonthGrid(2026, 7)
    expect(grid.length % 7).toBe(0)
    const dayCells = grid.filter(Boolean)
    expect(dayCells).toHaveLength(31)
    expect(dayCells[0]).toEqual({ date: '2026-07-01', day: 1 })
    expect(dayCells[30]).toEqual({ date: '2026-07-31', day: 31 })
  })

  it('1일 앞은 firstWeekdayOfMonth만큼 빈 칸(null)이다', () => {
    const grid = buildMonthGrid(2026, 7)
    const firstWeekday = firstWeekdayOfMonth(2026, 7)
    for (let i = 0; i < firstWeekday; i++) {
      expect(grid[i]).toBeNull()
    }
    expect(grid[firstWeekday]).toEqual({ date: '2026-07-01', day: 1 })
  })
})

describe('isDateInRange', () => {
  it('범위 양끝을 포함한다', () => {
    expect(isDateInRange('2026-06-09', '2026-06-09', '2026-06-22')).toBe(true)
    expect(isDateInRange('2026-06-22', '2026-06-09', '2026-06-22')).toBe(true)
    expect(isDateInRange('2026-06-15', '2026-06-09', '2026-06-22')).toBe(true)
  })

  it('범위 밖은 false', () => {
    expect(isDateInRange('2026-06-08', '2026-06-09', '2026-06-22')).toBe(false)
    expect(isDateInRange('2026-06-23', '2026-06-09', '2026-06-22')).toBe(false)
  })

  it('endDate가 없으면 startDate와 동일한 단일 날짜로 취급한다', () => {
    expect(isDateInRange('2026-09-01', '2026-09-01', null)).toBe(true)
    expect(isDateInRange('2026-09-02', '2026-09-01', null)).toBe(false)
  })

  it('startDate/dateStr이 없으면 false', () => {
    expect(isDateInRange(null, '2026-06-09', '2026-06-22')).toBe(false)
    expect(isDateInRange('2026-06-09', null, '2026-06-22')).toBe(false)
  })
})
