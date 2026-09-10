/**
 * 출처 줄이 승차 지점 단위인지 검증한다.
 *
 * 3400 은 시흥터미널에 시간표와 실시간이 함께 등록돼 있다. 지점 단위로 묶지
 * 않으면 같은 정류장 이름이 두 줄로 나오고, 두 줄이 같은 차를 각각 다른
 * 시각으로 말한다(실측: 시간표 09:00, 실시간 09:02).
 */
import { describe, it, expect } from 'vitest'
import { selectSourcesPerStop } from './busInformationSource'

// 프로덕션 3400 하교 실제 구성
const SOURCES_3400 = [
  { id: 1, stop_id: 17, type: 'timetable', display_label: '시흥터미널 승차', sort_order: 10 },
  { id: 33, stop_id: 17, type: 'realtime', display_label: '시흥터미널 승차', sort_order: 20 },
  { id: 2, stop_id: 2, type: 'realtime', display_label: '이마트 승차', sort_order: 30 },
]

describe('selectSourcesPerStop', () => {
  it('같은 정류장이 두 줄로 나오지 않는다', () => {
    const rows = selectSourcesPerStop(SOURCES_3400)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.stop_id)).toEqual([17, 2])
  })

  it('한 지점에 둘이 있으면 실시간을 대표로 쓴다', () => {
    const rows = selectSourcesPerStop(SOURCES_3400)
    expect(rows[0].type).toBe('realtime')
    expect(rows[0].id).toBe(33)
  })

  it('시간표만 있는 지점은 시간표를 그대로 쓴다', () => {
    const rows = selectSourcesPerStop([
      { id: 1, stop_id: 17, type: 'timetable', sort_order: 10 },
      { id: 2, stop_id: 2, type: 'realtime', sort_order: 20 },
    ])
    expect(rows.map((r) => r.type)).toEqual(['timetable', 'realtime'])
  })

  it('sort_order 를 따른다', () => {
    const rows = selectSourcesPerStop([
      { id: 2, stop_id: 2, type: 'realtime', sort_order: 30 },
      { id: 1, stop_id: 17, type: 'timetable', sort_order: 10 },
    ])
    expect(rows.map((r) => r.stop_id)).toEqual([17, 2])
  })

  it('빈 입력은 빈 배열이다', () => {
    expect(selectSourcesPerStop([])).toEqual([])
    expect(selectSourcesPerStop(null)).toEqual([])
  })
})
