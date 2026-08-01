import { describe, it, expect } from 'vitest'
import { computeTimetableSummary, groupTimesByHour, intervalLabel } from './timetableStats'

describe('computeTimetableSummary', () => {
  it('빈 배열이면 null', () => {
    expect(computeTimetableSummary([])).toBeNull()
    expect(computeTimetableSummary(null)).toBeNull()
    expect(computeTimetableSummary(undefined)).toBeNull()
  })

  it('첫차/막차/표본수를 계산한다', () => {
    const s = computeTimetableSummary(['07:10', '08:15', '22:50'])
    expect(s.firstBus).toBe('07:10')
    expect(s.lastBus).toBe('22:50')
    expect(s.count).toBe(3)
  })

  it('정렬되지 않은 입력도 정렬해서 계산한다', () => {
    const s = computeTimetableSummary(['22:50', '07:10', '08:15'])
    expect(s.firstBus).toBe('07:10')
    expect(s.lastBus).toBe('22:50')
  })

  it('배차 간격 계산 예시(등간격)', () => {
    const s = computeTimetableSummary(['06:00', '06:20', '06:40', '07:00'])
    expect(s.interval).toEqual({ min: 20, max: 20 })
  })

  it('배차 간격 계산 예시(불균등)', () => {
    const s = computeTimetableSummary(['06:00', '06:10', '06:40'])
    expect(s.interval).toEqual({ min: 10, max: 30 })
  })

  it('시각이 1개뿐이면 interval은 null', () => {
    const s = computeTimetableSummary(['07:10'])
    expect(s.firstBus).toBe('07:10')
    expect(s.lastBus).toBe('07:10')
    expect(s.interval).toBeNull()
  })

  it('파싱 불가한 항목은 무시한다', () => {
    const s = computeTimetableSummary(['07:10', 'invalid', '08:00'])
    expect(s.count).toBe(2)
  })
})

describe('groupTimesByHour', () => {
  it('시(hour) 단위로 그룹핑하고 오름차순 정렬한다', () => {
    const groups = groupTimesByHour(['08:15', '07:10', '07:40', '22:50'])
    expect(groups.map((g) => g.hour)).toEqual(['07', '08', '22'])
    expect(groups[0].times).toEqual(['07:10', '07:40'])
  })

  it('빈 입력이면 빈 배열', () => {
    expect(groupTimesByHour([])).toEqual([])
    expect(groupTimesByHour(null)).toEqual([])
  })
})

describe('intervalLabel', () => {
  it('min===max면 단일 값 표기', () => {
    expect(intervalLabel({ min: 20, max: 20 })).toBe('20분')
  })

  it('min!==max면 범위 표기', () => {
    expect(intervalLabel({ min: 10, max: 30 })).toBe('10~30분')
  })

  it('null이면 null', () => {
    expect(intervalLabel(null)).toBeNull()
  })
})
