import { describe, it, expect } from 'vitest'
import {
  formatShuttleAlarmMessage,
  formatShuttleAlarmSheetTitle,
  SHUTTLE_ALARM_LEAD_OPTIONS,
} from './shuttleAlarmMessage'

describe('formatShuttleAlarmMessage', () => {
  it('lead가 양수면 "N분 뒤 출발해요" 형태', () => {
    expect(formatShuttleAlarmMessage('17:50', 10)).toBe('17:50 셔틀이 10분 뒤 출발해요')
    expect(formatShuttleAlarmMessage('08:05', 5)).toBe('08:05 셔틀이 5분 뒤 출발해요')
  })

  it('lead가 0이면 "지금 출발해요"', () => {
    expect(formatShuttleAlarmMessage('17:50', 0)).toBe('17:50 셔틀이 지금 출발해요')
  })

  it('lead가 없으면(undefined/null) "지금 출발해요"로 방어한다', () => {
    expect(formatShuttleAlarmMessage('17:50', undefined)).toBe('17:50 셔틀이 지금 출발해요')
    expect(formatShuttleAlarmMessage('17:50', null)).toBe('17:50 셔틀이 지금 출발해요')
  })
})

describe('formatShuttleAlarmSheetTitle', () => {
  it('"HH:MM 셔틀 알림" 형태', () => {
    expect(formatShuttleAlarmSheetTitle('17:50')).toBe('17:50 셔틀 알림')
  })
})

describe('SHUTTLE_ALARM_LEAD_OPTIONS', () => {
  it('10분 전 / 5분 전 / 출발 시 3개 선택지를 제공한다', () => {
    expect(SHUTTLE_ALARM_LEAD_OPTIONS).toEqual([
      { id: 10, label: '10분 전' },
      { id: 5, label: '5분 전' },
      { id: 0, label: '출발 시' },
    ])
  })
})
