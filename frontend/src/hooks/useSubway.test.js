/**
 * useSubwayRealtime — tick 간격 회귀 테스트.
 *
 * 이 훅이 감싸는 실시간 데이터는 SubwayPanel/GlobalSubwayDetailSheet가
 * getEtaLabel·formatEta로 화면에 그린다 — "곧 도착"(90초 임계) 아니면
 * "N분"뿐이라 초 단위로 다시 그려도 사람 눈에는 아무것도 달라지지 않는다.
 * 그런데도 useNow(1000)으로 매초 재계산해 왔다 — 상시 리렌더를 줄이려면
 * 60초로 낮춰야 한다. 이 테스트는 1초 tick으로 되돌아가는 회귀를 잡는다.
 */
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('./useApi', () => ({
  useApi: vi.fn(),
}))

import { useApi } from './useApi'
import { useSubwayRealtime } from './useSubway'

describe('useSubwayRealtime — tick 간격', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-13T15:30:00'))
    useApi.mockReturnValue({
      data: { 정왕: [{ line: '4호선', direction: '상행', arrive_seconds: 600 }] },
      loading: false,
      error: null,
      fetchedAt: Date.now(),
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1초가 지나도 재렌더하지 않는다(화면이 분 단위 텍스트만 쓰므로)', () => {
    let renderCount = 0
    renderHook(() => {
      renderCount++
      return useSubwayRealtime()
    })
    const afterMount = renderCount

    act(() => { vi.advanceTimersByTime(1000) })

    expect(renderCount).toBe(afterMount)
  })

  it('60초가 지나면 재렌더한다(15초 refetch 사이 간극을 메우는 tick)', () => {
    let renderCount = 0
    renderHook(() => {
      renderCount++
      return useSubwayRealtime()
    })
    const afterMount = renderCount

    act(() => { vi.advanceTimersByTime(60_000) })

    expect(renderCount).toBeGreaterThan(afterMount)
  })
})
