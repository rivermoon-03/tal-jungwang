import { describe, it, expect } from 'vitest'
import { buildBusRows } from './busRows'

const rt = (route_no, sec, loc) => ({ route_no, arrival_type: 'realtime', arrive_in_seconds: sec, location_no: loc, remain_seat: -1 })

describe('buildBusRows', () => {
  it('노선별로 묶고 도착순 정렬, 다음 차와 정거장 수를 붙인다', () => {
    const rows = buildBusRows([rt('6502', 420, 4), rt('3400', 60, 2), rt('3400', 1080, 9)], { 3400: { dest: '강남' } }, 600)
    expect(rows.map((r) => r.route)).toEqual(['3400', '6502'])
    expect(rows[0]).toMatchObject({ dest: '강남', main: '곧 도착', position: '2정거장 전', soon: true, nextLabel: '다음 18분' })
    expect(rows[1]).toMatchObject({ main: '7분', position: '4정거장 전', soon: false, nextLabel: null })
  })

  it('운행 종료 노선은 맨 뒤, 첫차 시각을 보여준다', () => {
    const rows = buildBusRows(
      [{ route_no: '20-1', arrival_type: 'timetable', off_service: true, next_first_at: '05:20' }, rt('33', 300, 3)],
      {},
      600,
    )
    expect(rows[1]).toMatchObject({ route: '20-1', main: '운행 종료', position: '첫차 05:20' })
  })

  it('시간표 기반은 출발 시각을 그대로 쓰고 위치 대신 시간표 기준이라고 쓴다', () => {
    const [row] = buildBusRows([{ route_no: '시흥1', arrival_type: 'timetable', depart_at: '10:22' }], {}, 600)
    expect(row).toMatchObject({ main: '10:22', position: '시간표 기준', sec: 1320 })
  })
})

describe('destKey', () => {
  it('마지막 행선지만 남긴다', async () => {
    const { destKey, destKeysOf } = await import('./busRows')
    expect(destKey('사당 경유 강남행')).toBe('강남행')
    expect(destKey('정왕역 경유')).toBe('정왕역행')
    expect(destKey('월곶역 방면')).toBe('월곶역행')
    expect(destKey('학교행')).toBe('학교행')
    expect(destKeysOf({ a: { dest: '정왕역행' }, b: { dest: '정왕역 경유' }, c: { dest: '정왕역 경유 시흥시청행' } })).toEqual(['정왕역행', '시흥시청행'])
  })
})

describe('실시간 정보가 없는 노선', () => {
  it('남은 시간이 없으면 곧 도착이 아니라 도착 정보 없음이고 맨 뒤로 간다', async () => {
    const { buildBusRows, seatsLabel } = await import('./busRows')
    const rows = buildBusRows(
      [{ route_no: '5200', arrival_type: 'realtime', arrive_in_seconds: null, location_no: 0, remain_seat: -1 }, rt('3400', 1440, 14)],
      {},
      600,
    )
    expect(rows.map((r) => r.route)).toEqual(['3400', '5200'])
    expect(rows[1]).toMatchObject({ main: '도착 정보 없음', position: null, noInfo: true, soon: false })
    expect(seatsLabel(13)).toBe('13석 남음')
    expect(seatsLabel(0)).toBe('만석')
    expect(seatsLabel(-1)).toBe(null)
  })

  it('정거장 수가 없어도 90초 넘게 남았으면 곧 도착이라 쓰지 않는다', async () => {
    const { buildBusRows } = await import('./busRows')
    const [row] = buildBusRows([rt('99-2', 600, 0)], {}, 600)
    expect(row.position).toBe(null)
  })
})
