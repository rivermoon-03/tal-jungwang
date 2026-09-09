import { describe, it, expect } from 'vitest'
import { buildScheduleHint } from './scheduleHint'
import { BUS_GROUP_IDS } from '../schedule/busGroups'

const VALID_BUS_GROUPS = BUS_GROUP_IDS.map((g) => g.id)

describe('buildScheduleHint', () => {
  it('버스 힌트의 group 은 시간표 화면이 아는 값이다', () => {
    const stations = [
      { type: 'bus', primaryStopGbisId: '224000639' },
      { type: 'bus_seoul', isLocalHub: true, route: '3400' },
      { type: 'bus_seoul', isLocalHub: false, route: '6502' },
    ]
    for (const s of stations) {
      const hint = buildScheduleHint(s)
      expect(hint.mode).toBe('bus')
      expect(VALID_BUS_GROUPS).toContain(hint.group)
    }
  })

  it('학교 주변 허브는 하교, 서울 허브는 등교다', () => {
    expect(buildScheduleHint({ type: 'bus', primaryStopGbisId: 'x' }).group).toBe('하교')
    expect(buildScheduleHint({ type: 'bus_seoul', isLocalHub: true }).group).toBe('하교')
    expect(buildScheduleHint({ type: 'bus_seoul', isLocalHub: false }).group).toBe('등교')
  })

  it('셔틀은 캠퍼스를 넘긴다 — 없으면 제2 마커가 본캠 시간표를 연다', () => {
    expect(buildScheduleHint({ type: 'shuttle', direction: 0 }).group).toBe('main')
    expect(buildScheduleHint({ type: 'shuttle', direction: 1 }).group).toBe('main')
    expect(buildScheduleHint({ type: 'shuttle', direction: 2 }).group).toBe('second')
    expect(buildScheduleHint({ type: 'shuttle', direction: 3 }).group).toBe('second')
    expect(buildScheduleHint({ type: 'shuttle' }).group).toBe('main')
  })

  it('지하철과 서해선은 역 이름을 넘긴다', () => {
    expect(buildScheduleHint({ type: 'subway' })).toEqual({ mode: 'subway', group: '정왕' })
    expect(buildScheduleHint({ type: 'seohae', tabId: 'choji' }).group).toBe('초지')
    expect(buildScheduleHint({ type: 'seohae', tabId: 'siheung' }).group).toBe('시흥시청')
  })

  it('모르는 타입과 null 은 힌트를 만들지 않는다', () => {
    expect(buildScheduleHint(null)).toBeNull()
    expect(buildScheduleHint({ type: 'taxi' })).toBeNull()
  })

  it('노선 코드는 서울 허브에서만 붙인다', () => {
    expect(buildScheduleHint({ type: 'bus_seoul', route: '3400' }).routeCode).toBe('3400')
    expect(buildScheduleHint({ type: 'bus' }).routeCode).toBeUndefined()
  })
})
