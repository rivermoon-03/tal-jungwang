import { describe, it, expect, beforeEach } from 'vitest'
import {
  SHUTTLE_ALARM_STORAGE_KEY,
  alarmFireDate,
  saveShuttleAlarms,
  loadShuttleAlarms,
  upsertShuttleAlarm,
  removeShuttleAlarm,
  findShuttleAlarm,
} from './shuttleAlarmStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('alarmFireDate', () => {
  it('lead만큼 앞당긴 오늘 날짜의 Date를 반환한다', () => {
    const now = new Date(2026, 6, 19, 10, 0, 0)
    const fire = alarmFireDate('17:50', 10, now)
    expect(fire.getHours()).toBe(17)
    expect(fire.getMinutes()).toBe(40)
    expect(fire.getFullYear()).toBe(2026)
    expect(fire.getMonth()).toBe(6)
    expect(fire.getDate()).toBe(19)
  })

  it('lead가 0이면 시각 그대로', () => {
    const now = new Date(2026, 6, 19, 10, 0, 0)
    const fire = alarmFireDate('08:05', 0, now)
    expect(fire.getHours()).toBe(8)
    expect(fire.getMinutes()).toBe(5)
  })

  it('자정을 넘겨 앞당기면 전날로 넘어간다(음수 분 처리)', () => {
    const now = new Date(2026, 6, 19, 10, 0, 0)
    const fire = alarmFireDate('00:05', 10, now)
    expect(fire.getDate()).toBe(18)
    expect(fire.getHours()).toBe(23)
    expect(fire.getMinutes()).toBe(55)
  })
})

describe('saveShuttleAlarms / loadShuttleAlarms', () => {
  it('저장한 값을 그대로 불러온다(미래 시각)', () => {
    const now = new Date(2026, 6, 19, 10, 0, 0)
    const alarms = [{ time: '17:50', lead: 10, direction: 0 }]
    saveShuttleAlarms(alarms)
    expect(loadShuttleAlarms(now)).toEqual(alarms)
  })

  it('발화 시각이 지난 예약은 로드 시 제거되고 저장소도 갱신된다', () => {
    const now = new Date(2026, 6, 19, 20, 0, 0)
    saveShuttleAlarms([
      { time: '17:50', lead: 10, direction: 0 }, // 이미 지남
      { time: '21:00', lead: 5, direction: 1 },  // 아직 남음
    ])
    const loaded = loadShuttleAlarms(now)
    expect(loaded).toEqual([{ time: '21:00', lead: 5, direction: 1 }])

    const stored = JSON.parse(localStorage.getItem(SHUTTLE_ALARM_STORAGE_KEY))
    expect(stored).toEqual([{ time: '21:00', lead: 5, direction: 1 }])
  })

  it('저장소가 비어있으면 빈 배열', () => {
    expect(loadShuttleAlarms()).toEqual([])
  })

  it('손상된 JSON이면 빈 배열로 방어한다', () => {
    localStorage.setItem(SHUTTLE_ALARM_STORAGE_KEY, '{not-json')
    expect(loadShuttleAlarms()).toEqual([])
  })

  it('배열이 아니거나 필드가 빠진 항목은 걸러낸다', () => {
    localStorage.setItem(
      SHUTTLE_ALARM_STORAGE_KEY,
      JSON.stringify([{ time: '17:50' }, { time: 'bad', lead: 5, direction: 0 }, null])
    )
    expect(loadShuttleAlarms()).toEqual([])
  })
})

describe('upsertShuttleAlarm', () => {
  it('새 (time, direction)이면 추가한다', () => {
    const next = upsertShuttleAlarm([], { time: '17:50', lead: 10, direction: 0 })
    expect(next).toEqual([{ time: '17:50', lead: 10, direction: 0 }])
  })

  it('같은 (time, direction)이 있으면 lead를 교체한다(중복 생성 금지)', () => {
    const prev = [{ time: '17:50', lead: 10, direction: 0 }]
    const next = upsertShuttleAlarm(prev, { time: '17:50', lead: 5, direction: 0 })
    expect(next).toEqual([{ time: '17:50', lead: 5, direction: 0 }])
  })

  it('direction이 다르면 같은 time이어도 별개 예약으로 취급한다', () => {
    const prev = [{ time: '17:50', lead: 10, direction: 0 }]
    const next = upsertShuttleAlarm(prev, { time: '17:50', lead: 5, direction: 1 })
    expect(next).toEqual([
      { time: '17:50', lead: 10, direction: 0 },
      { time: '17:50', lead: 5, direction: 1 },
    ])
  })
})

describe('removeShuttleAlarm / findShuttleAlarm', () => {
  it('removeShuttleAlarm은 일치하는 (time, direction)만 제거한다', () => {
    const prev = [
      { time: '17:50', lead: 10, direction: 0 },
      { time: '17:50', lead: 5, direction: 1 },
    ]
    expect(removeShuttleAlarm(prev, '17:50', 0)).toEqual([
      { time: '17:50', lead: 5, direction: 1 },
    ])
  })

  it('findShuttleAlarm은 일치 항목을 반환하고 없으면 null', () => {
    const prev = [{ time: '17:50', lead: 10, direction: 0 }]
    expect(findShuttleAlarm(prev, '17:50', 0)).toEqual(prev[0])
    expect(findShuttleAlarm(prev, '08:00', 0)).toBeNull()
  })
})
