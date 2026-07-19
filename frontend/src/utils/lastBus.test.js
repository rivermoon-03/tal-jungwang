import { describe, it, expect } from 'vitest'
import { getLastBusStatus } from './lastBus'

// now는 KST 오프셋(+09:00)을 명시해 브라우저 로컬 타임존과 무관하게 고정한다.
function kst(hhmm) {
  return new Date(`2026-07-19T${hhmm}:00+09:00`)
}

describe('getLastBusStatus', () => {
  it('entries가 비어있으면 판정 불가를 반환한다', () => {
    expect(getLastBusStatus([], kst('22:00'))).toEqual({
      isLast: false,
      departure: null,
      minutesLeft: null,
    })
    expect(getLastBusStatus(null, kst('22:00'))).toEqual({
      isLast: false,
      departure: null,
      minutesLeft: null,
    })
  })

  it('is_last로 표시된 항목을 막차로 우선한다', () => {
    const entries = [
      { depart_at: '20:00' },
      { depart_at: '20:30', is_last: true },
      { depart_at: '20:15' }, // 순서가 뒤섞여도 is_last 항목을 우선
    ]
    const status = getLastBusStatus(entries, kst('20:10'))
    expect(status.departure).toBe('20:30')
    expect(status.isLast).toBe(true)
    expect(status.minutesLeft).toBe(20)
  })

  it('is_last 표시가 없으면 배열의 마지막 원소를 막차로 간주한다', () => {
    const entries = [{ depart_at: '19:00' }, { depart_at: '22:30' }]
    const status = getLastBusStatus(entries, kst('22:10'))
    expect(status.departure).toBe('22:30')
    expect(status.minutesLeft).toBe(20)
  })

  it('막차가 30분보다 먼 미래여도 isLast는 true, minutesLeft만 크게 반환한다 (임계값은 호출부 책임)', () => {
    const entries = [{ depart_at: '23:00', is_last: true }]
    const status = getLastBusStatus(entries, kst('20:00'))
    expect(status.isLast).toBe(true)
    expect(status.minutesLeft).toBe(180)
  })

  it('막차가 정확히 출발하는 순간(0분 남음)도 isLast=true', () => {
    const entries = [{ depart_at: '22:00', is_last: true }]
    const status = getLastBusStatus(entries, kst('22:00'))
    expect(status.isLast).toBe(true)
    expect(status.minutesLeft).toBe(0)
  })

  it('막차가 이미 출발했으면 isLast=false, minutesLeft=null', () => {
    const entries = [{ depart_at: '22:00', is_last: true }]
    const status = getLastBusStatus(entries, kst('22:30'))
    expect(status.isLast).toBe(false)
    expect(status.minutesLeft).toBeNull()
    expect(status.departure).toBe('22:00') // 참고용으로 출발 시각은 유지
  })

  it('자정 넘김: 23:50에 00:20 막차는 "30분 남음"으로 인식한다', () => {
    const entries = [
      { depart_at: '22:00' },
      { depart_at: '00:20', is_last: true },
    ]
    const status = getLastBusStatus(entries, kst('23:50'))
    expect(status.isLast).toBe(true)
    expect(status.minutesLeft).toBe(30)
    expect(status.departure).toBe('00:20')
  })

  it('자정 넘김: 새벽 00:05에 00:20 막차는 이미 자정을 넘긴 같은 연속선에서 15분 남음', () => {
    const entries = [{ depart_at: '00:20', is_last: true }]
    const status = getLastBusStatus(entries, kst('00:05'))
    expect(status.isLast).toBe(true)
    expect(status.minutesLeft).toBe(15)
  })

  it('자정 넘김: 새벽 00:30에 00:20 막차는 이미 출발함(isLast=false)', () => {
    const entries = [{ depart_at: '00:20', is_last: true }]
    const status = getLastBusStatus(entries, kst('00:30'))
    expect(status.isLast).toBe(false)
    expect(status.minutesLeft).toBeNull()
  })

  it('depart_at 형식이 잘못되면 판정 불가를 반환한다', () => {
    const entries = [{ depart_at: 'invalid', is_last: true }]
    const status = getLastBusStatus(entries, kst('22:00'))
    expect(status).toEqual({ isLast: false, departure: null, minutesLeft: null })
  })

  it('depart_at이 undefined/빈 문자열이어도 자정(00:00)으로 오판하지 않는다', () => {
    // Number('')가 0으로 캐스팅되는 함정 — 회귀 방지
    expect(getLastBusStatus([{ depart_at: undefined, is_last: true }], kst('22:00'))).toEqual({
      isLast: false,
      departure: null,
      minutesLeft: null,
    })
    expect(getLastBusStatus([{ depart_at: '', is_last: true }], kst('22:00'))).toEqual({
      isLast: false,
      departure: null,
      minutesLeft: null,
    })
  })
})
