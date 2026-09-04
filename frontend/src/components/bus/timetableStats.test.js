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

  // 3400 등교(강남역 출발) 실측 시간표(2026-09-04 GET /bus/timetable-by-route/3400?category=등교).
  // 00:10, 00:30 다음이 07:00이라 그 사이가 390분 벌어진다 — 나머지는 15~30분
  // 간격이라 이 390분만 심야 운행 공백이지 배차가 아니다.
  const ROUTE_3400_SCHOOLBOUND_WEEKDAY = [
    '00:10', '00:30', '07:00', '07:30', '07:55', '08:15', '08:30', '08:50',
    '09:15', '09:40', '10:10', '10:35', '11:00', '11:30', '11:55', '12:20',
    '12:45', '13:10', '13:35', '14:00', '14:25', '14:50', '15:20', '15:45',
    '16:10', '16:40', '17:05', '17:30', '17:55', '18:20', '18:45', '19:10',
    '19:40', '20:10', '20:35', '21:00', '21:25', '21:50', '22:15', '22:40',
    '23:05', '23:30', '23:50',
  ]

  it('심야 공백(00:30~07:00, 390분)은 배차 계산에서 빼고 별도 사실로 돌려준다', () => {
    const s = computeTimetableSummary(ROUTE_3400_SCHOOLBOUND_WEEKDAY)
    expect(s.interval).toEqual({ min: 15, max: 30 })
    expect(s.overnightGaps).toEqual([{ from: '00:30', to: '07:00', minutes: 390 }])
  })

  // 시흥20-1(하교, 아이파크아파트방면) 실측 시간표. 편수가 적어 간격이 14~130분으로
  // 원래 넓다 — 심야 공백처럼 통계적으로 튀는 한 값이 아니라 하루 내내 서서히
  // 벌어졌다 좁혀졌다 하는 분포라, 어떤 값도 공백으로 잘라내면 안 된다.
  const ROUTE_20_1_WEEKDAY = [
    '06:12', '07:24', '07:54', '08:40', '09:00', '09:40', '10:24', '10:54',
    '11:08', '11:30', '12:28', '12:54', '13:28', '14:04', '14:28', '15:52',
    '16:22', '16:48', '18:58', '20:36', '20:54', '21:48',
  ]

  it('편수가 적어 원래 배차가 넓은 노선은 큰 간격도 그대로 배차에 남는다', () => {
    const s = computeTimetableSummary(ROUTE_20_1_WEEKDAY)
    expect(s.interval).toEqual({ min: 14, max: 130 })
    expect(s.overnightGaps).toEqual([])
  })

  it('간격이 전부 같으면 overnightGaps가 빈 배열이다', () => {
    const s = computeTimetableSummary(['06:00', '06:20', '06:40', '07:00'])
    expect(s.overnightGaps).toEqual([])
  })

  it('시각이 1개뿐이면 overnightGaps도 빈 배열이다', () => {
    const s = computeTimetableSummary(['07:10'])
    expect(s.overnightGaps).toEqual([])
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
