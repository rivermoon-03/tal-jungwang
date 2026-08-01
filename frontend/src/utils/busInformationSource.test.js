import { describe, expect, it } from 'vitest'
import { selectRepresentativeBusSource } from './busInformationSource'

const timetable = (id, stopId) => ({ id, type: 'timetable', stop_id: stopId, sort_order: id })
const realtime = (id, stopId) => ({ id, type: 'realtime', stop_id: stopId, sort_order: id })

describe('selectRepresentativeBusSource', () => {
  it('실시간 전용과 시간표 전용은 해당 source를 그대로 선택한다', () => {
    expect(selectRepresentativeBusSource([realtime(1, 3)])?.id).toBe(1)
    expect(selectRepresentativeBusSource([timetable(2, 17)])?.id).toBe(2)
  })

  it('같은 정류장에 시간표와 실시간이 있으면 실시간을 우선한다', () => {
    expect(selectRepresentativeBusSource([timetable(1, 3), realtime(2, 3)])?.id).toBe(2)
  })

  it('서로 다른 정류장의 시간표와 실시간은 실제 출발 시간표를 우선한다', () => {
    expect(selectRepresentativeBusSource([timetable(1, 17), realtime(2, 2)])?.id).toBe(1)
  })

  it('실시간 승차점이 여러 개면 정렬상 첫 source를 선택한다', () => {
    expect(selectRepresentativeBusSource([realtime(10, 17), realtime(20, 2)])?.id).toBe(10)
  })
})
