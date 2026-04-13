import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('두 자리 제로패딩 mm/ss 반환', () => {
    vi.setSystemTime(new Date('2026-04-13T15:30:00'))
    const { result } = renderHook(() => useCountdown('15:32'))
    expect(result.current.mm).toBe('02')
    expect(result.current.ss).toBe('00')
    expect(result.current.totalSeconds).toBe(120)
    expect(result.current.isUrgent).toBe(false)
  })

  it('60초 미만이면 isUrgent = true', () => {
    vi.setSystemTime(new Date('2026-04-13T15:30:30'))
    const { result } = renderHook(() => useCountdown('15:31'))
    expect(result.current.totalSeconds).toBe(30)
    expect(result.current.isUrgent).toBe(true)
  })

  it('이미 지난 시각이면 isExpired = true, totalSeconds = 0, mm/ss = 00:00', () => {
    vi.setSystemTime(new Date('2026-04-13T15:35:00'))
    const { result } = renderHook(() => useCountdown('15:32'))
    expect(result.current.isExpired).toBe(true)
    expect(result.current.totalSeconds).toBe(0)
    expect(result.current.mm).toBe('00')
    expect(result.current.ss).toBe('00')
  })

  it('1초 경과하면 totalSeconds 감소', () => {
    vi.setSystemTime(new Date('2026-04-13T15:30:00'))
    const { result } = renderHook(() => useCountdown('15:32'))
    expect(result.current.totalSeconds).toBe(120)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.totalSeconds).toBe(119)
  })

  it('자정 넘어가는 시각을 내일 출발로 처리', () => {
    // Current time: 23:50, target: 00:10 (next day, 20 minutes away)
    vi.setSystemTime(new Date('2026-04-13T23:50:00'))
    const { result } = renderHook(() => useCountdown('00:10'))
    expect(result.current.totalSeconds).toBe(1200) // 20 minutes = 1200 seconds
    expect(result.current.mm).toBe('20')
    expect(result.current.ss).toBe('00')
  })
})
