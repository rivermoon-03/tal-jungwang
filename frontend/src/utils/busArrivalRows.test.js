/**
 * busArrivalRows — A1 잔여좌석 칩 / A3 "N정거장 전" 칩 순수 함수 테스트.
 *
 * remain_seat 규약(백엔드 gbis 파싱): -1 = 정보 없음, 0 = 만차, N = 잔여 N석.
 * 구형 캐시(키 자체가 없음)와 비광역·비실시간 항목은 칩 없음(null)이어야 한다.
 */
import { describe, it, expect } from 'vitest'
import { locationChipFromArrival, seatChipFromArrival } from './busArrivalRows'

const realtime = (extra = {}) => ({ arrival_type: 'realtime', ...extra })

describe('seatChipFromArrival — 광역버스 잔여좌석 칩', () => {
  it('11석 이상은 green 톤 "잔여 N석"', () => {
    expect(seatChipFromArrival(realtime({ remain_seat: 23 }), { isExpress: true }))
      .toEqual({ label: '잔여 23석', tone: 'good' })
    expect(seatChipFromArrival(realtime({ remain_seat: 11 }), { isExpress: true }))
      .toEqual({ label: '잔여 11석', tone: 'good' })
  })

  it('1~10석은 warn 톤 "잔여 N석"', () => {
    expect(seatChipFromArrival(realtime({ remain_seat: 10 }), { isExpress: true }))
      .toEqual({ label: '잔여 10석', tone: 'warn' })
    expect(seatChipFromArrival(realtime({ remain_seat: 1 }), { isExpress: true }))
      .toEqual({ label: '잔여 1석', tone: 'warn' })
  })

  it('0석은 delayed 톤 "만차"', () => {
    expect(seatChipFromArrival(realtime({ remain_seat: 0 }), { isExpress: true }))
      .toEqual({ label: '만차', tone: 'delayed' })
  })

  it('-1(정보 없음)·키 없음(구형 캐시)은 null — 혼잡도 칩 유지 신호', () => {
    expect(seatChipFromArrival(realtime({ remain_seat: -1 }), { isExpress: true })).toBeNull()
    expect(seatChipFromArrival(realtime(), { isExpress: true })).toBeNull()
  })

  it('비광역 노선은 좌석값이 있어도 null', () => {
    expect(seatChipFromArrival(realtime({ remain_seat: 5 }), { isExpress: false })).toBeNull()
    expect(seatChipFromArrival(realtime({ remain_seat: 5 }))).toBeNull()
  })

  it('시간표 항목·null 항목은 null', () => {
    expect(
      seatChipFromArrival({ arrival_type: 'timetable', remain_seat: 5 }, { isExpress: true })
    ).toBeNull()
    expect(seatChipFromArrival(null, { isExpress: true })).toBeNull()
  })
})

describe('locationChipFromArrival — "N정거장 전" 칩', () => {
  it('location_no ≥ 1이면 gray 톤 칩', () => {
    expect(locationChipFromArrival(realtime({ location_no: 1 })))
      .toEqual({ label: '1정거장 전', tone: 'neutral' })
    expect(locationChipFromArrival(realtime({ location_no: 7 })))
      .toEqual({ label: '7정거장 전', tone: 'neutral' })
  })

  it('0·음수·키 없음(구형 캐시)은 null', () => {
    expect(locationChipFromArrival(realtime({ location_no: 0 }))).toBeNull()
    expect(locationChipFromArrival(realtime({ location_no: -2 }))).toBeNull()
    expect(locationChipFromArrival(realtime())).toBeNull()
  })

  it('시간표 항목·null 항목은 null', () => {
    expect(locationChipFromArrival({ arrival_type: 'timetable', location_no: 3 })).toBeNull()
    expect(locationChipFromArrival(null)).toBeNull()
  })
})
