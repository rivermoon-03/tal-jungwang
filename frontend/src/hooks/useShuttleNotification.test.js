import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useShuttleNotification, useShuttleAlarms } from './useShuttleNotification'
import { SHUTTLE_ALARM_STORAGE_KEY } from '../utils/shuttleAlarmStorage'

function stubNotification(permission, requestPermissionResult) {
  const NotificationMock = vi.fn().mockImplementation(function (title, options) {
    this.title = title
    this.options = options
  })
  NotificationMock.permission = permission
  NotificationMock.requestPermission = vi.fn().mockResolvedValue(requestPermissionResult ?? permission)
  Object.defineProperty(globalThis, 'Notification', {
    value: NotificationMock,
    configurable: true,
    writable: true,
  })
  return NotificationMock
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete globalThis.Notification
})

describe('useShuttleNotification (기존 10분 전 고정 토글)', () => {
  it('초기 enabled는 localStorage 값을 따른다', () => {
    localStorage.setItem('shuttle_notification_enabled', '1')
    const { result } = renderHook(() => useShuttleNotification([]))
    expect(result.current.enabled).toBe(true)
  })

  it('toggle 시 권한이 없으면 요청하고, 거부되면 enabled를 켜지 않는다', async () => {
    stubNotification('default', 'denied')
    const { result } = renderHook(() => useShuttleNotification([]))
    await act(async () => {
      await result.current.toggle()
    })
    expect(result.current.enabled).toBe(false)
  })

  it('권한이 허용되면 enabled를 켜고 localStorage에 저장한다', async () => {
    stubNotification('default', 'granted')
    const { result } = renderHook(() => useShuttleNotification([]))
    await act(async () => {
      await result.current.toggle()
    })
    expect(result.current.enabled).toBe(true)
    expect(localStorage.getItem('shuttle_notification_enabled')).toBe('1')
  })
})

describe('useShuttleAlarms', () => {
  it('저장된 예약이 없으면 빈 배열로 시작한다', () => {
    const { result } = renderHook(() => useShuttleAlarms())
    expect(result.current.alarms).toEqual([])
  })

  it('과거 예약은 로드 시 자가 정리된다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 20, 0, 0))
    localStorage.setItem(
      SHUTTLE_ALARM_STORAGE_KEY,
      JSON.stringify([{ time: '17:50', lead: 10, direction: 0 }])
    )
    const { result } = renderHook(() => useShuttleAlarms())
    expect(result.current.alarms).toEqual([])
  })

  it('addAlarm은 권한이 허용되면 예약을 추가하고 localStorage에 저장한다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 10, 0, 0))
    stubNotification('default', 'granted')
    const { result } = renderHook(() => useShuttleAlarms())

    let addResult
    await act(async () => {
      addResult = await result.current.addAlarm('17:50', 10, 0)
    })

    expect(addResult).toEqual({ ok: true })
    expect(result.current.alarms).toEqual([{ time: '17:50', lead: 10, direction: 0 }])
    expect(result.current.isAlarmSet('17:50', 0)).toBe(true)
    const stored = JSON.parse(localStorage.getItem(SHUTTLE_ALARM_STORAGE_KEY))
    expect(stored).toEqual([{ time: '17:50', lead: 10, direction: 0 }])
  })

  it('addAlarm은 권한이 거부되면 예약을 추가하지 않는다', async () => {
    stubNotification('denied')
    const { result } = renderHook(() => useShuttleAlarms())

    let addResult
    await act(async () => {
      addResult = await result.current.addAlarm('17:50', 10, 0)
    })

    expect(addResult).toEqual({ ok: false, reason: 'denied' })
    expect(result.current.alarms).toEqual([])
  })

  it('removeAlarm은 해당 예약만 제거한다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 10, 0, 0))
    stubNotification('granted')
    const { result } = renderHook(() => useShuttleAlarms())

    await act(async () => {
      await result.current.addAlarm('17:50', 10, 0)
      await result.current.addAlarm('18:00', 5, 1)
    })
    expect(result.current.alarms).toHaveLength(2)

    act(() => {
      result.current.removeAlarm('17:50', 0)
    })

    expect(result.current.alarms).toEqual([{ time: '18:00', lead: 5, direction: 1 }])
  })

  it('예약 시각(리드타임 반영)이 되면 Notification을 발송하고 목록에서 제거한다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 17, 39, 0))
    const notif = stubNotification('granted')
    const { result } = renderHook(() => useShuttleAlarms())

    await act(async () => {
      await result.current.addAlarm('17:50', 10, 0) // 17:40에 발화
    })

    act(() => {
      vi.advanceTimersByTime(60_000) // 17:40 도달
    })

    expect(notif).toHaveBeenCalledWith('셔틀 알림', expect.objectContaining({
      body: '17:50 셔틀이 10분 뒤 출발해요',
    }))
    expect(result.current.alarms).toEqual([])
  })

  it('언마운트 시 예약된 타이머를 정리한다(좀비 타이머 방지)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 17, 39, 0))
    const notif = stubNotification('granted')
    const { result, unmount } = renderHook(() => useShuttleAlarms())

    await act(async () => {
      await result.current.addAlarm('17:50', 10, 0)
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(120_000)
    })

    expect(notif).not.toHaveBeenCalled()
  })
})
