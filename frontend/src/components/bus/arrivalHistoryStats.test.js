import { describe, it, expect } from 'vitest'
import { computeHeadwayRangeMin, headwayRangeLabel } from './arrivalHistoryStats'

describe('computeHeadwayRangeMin', () => {
  it('columns가 없으면 null', () => {
    expect(computeHeadwayRangeMin(null)).toBeNull()
    expect(computeHeadwayRangeMin([])).toBeNull()
  })

  it('now 기준 windowMin 밖의 기록은 제외한다', () => {
    const now = new Date('2026-08-01T15:00:00')
    const columns = [
      { times: ['08:00', '08:20', '08:40'] }, // 15:00과 너무 멀어 제외
      { times: ['14:30', '15:00', '15:25'] }, // 포함 대상(간격 30, 25)
    ]
    const range = computeHeadwayRangeMin(columns, now, 90)
    expect(range).toEqual({ min: 25, max: 30 })
  })

  it('여러 컬럼의 간격을 모두 모아 min/max를 계산한다', () => {
    const now = new Date('2026-08-01T15:00:00')
    const columns = [
      { times: ['14:40', '15:00', '15:20'] }, // 간격 20, 20
      { times: ['14:30', '15:10'] },          // 간격 40
    ]
    const range = computeHeadwayRangeMin(columns, now, 90)
    expect(range).toEqual({ min: 20, max: 40 })
  })

  it('간격을 계산할 기록이 2건 미만이면 null', () => {
    const now = new Date('2026-08-01T15:00:00')
    const columns = [{ times: ['15:00'] }]
    expect(computeHeadwayRangeMin(columns, now)).toBeNull()
  })

  it('빈 times 배열은 무시된다', () => {
    const now = new Date('2026-08-01T15:00:00')
    const columns = [{ times: [] }, { times: ['14:50', '15:10'] }]
    const range = computeHeadwayRangeMin(columns, now, 90)
    expect(range).toEqual({ min: 20, max: 20 })
  })
})

describe('headwayRangeLabel', () => {
  it('null이면 null', () => {
    expect(headwayRangeLabel(null)).toBeNull()
  })

  it('min===max면 단일 값', () => {
    expect(headwayRangeLabel({ min: 20, max: 20 })).toBe('20분 간격')
  })

  it('min!==max면 범위', () => {
    expect(headwayRangeLabel({ min: 10, max: 30 })).toBe('10~30분 간격')
  })
})
