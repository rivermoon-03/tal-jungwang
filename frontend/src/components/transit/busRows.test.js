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
