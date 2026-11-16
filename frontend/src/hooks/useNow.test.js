import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNow } from './useNow'

describe('useNow', () => {
  afterEach(() => vi.useRealTimers())

  it('같은 간격의 구독자는 타이머 하나를 공유하고 같은 시각을 받는다', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(globalThis, 'setInterval')
    const a = renderHook(() => useNow(1000))
    const b = renderHook(() => useNow(1000))
    expect(spy).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(a.result.current).toBe(b.result.current)
    a.unmount()
    b.unmount()
    spy.mockRestore()
  })

  it('시간이 흐르면 값이 바뀐다', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useNow(1000))
    const first = result.current
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBeGreaterThan(first)
    unmount()
  })
})
