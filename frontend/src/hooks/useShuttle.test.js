import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useShuttleSchedule } from './useShuttle'
import { invalidateApiCache } from './useApi'

// 백엔드 응답 shape: { success, data, error }
function ok(data) {
  return { ok: true, json: async () => ({ success: true, data }) }
}

// 운행 기간이 학기에서 계절학기로 전환된 상황을 흉내낸다.
// 지도 컴팩트 띠처럼 오래 마운트된 화면이 첫 응답(학기)을 고착하지 않고
// 포그라운드 복귀 시 최신(계절학기)으로 자가회복해야 한다.
const SEMESTER = { schedule_type: 'SEMESTER', directions: [{ direction: 0, times: [{ depart_at: '08:40' }] }] }
const SEASONAL = { schedule_type: 'SEASONAL', directions: [{ direction: 0, times: [{ depart_at: '08:41' }] }] }

beforeEach(() => {
  invalidateApiCache()
  vi.restoreAllMocks()
  vi.useRealTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useShuttleSchedule 기간 전환 자가회복 (지도 stale 회귀)', () => {
  it('오늘자 시간표는 포그라운드 복귀(visibilitychange) 시 재fetch해 최신 기간으로 갱신된다', async () => {
    let calls = 0
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      calls += 1
      // 첫 응답은 학기, 이후 재검증부터는 계절학기.
      return Promise.resolve(ok(calls <= 1 ? SEMESTER : SEASONAL))
    })

    const { result, unmount } = renderHook(() => useShuttleSchedule(0))

    // 최초 마운트는 학기 시간표.
    await waitFor(() => expect(result.current.data?.schedule_type).toBe('SEMESTER'))

    // 앱이 다시 포그라운드로 돌아오면(다음 날이나 기간 전환 이후) 재검증되어야 한다.
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(result.current.data?.schedule_type).toBe('SEASONAL'))

    unmount()
  })

  it('특정 날짜 고정 조회(dateStr)는 정적이라 폴링 타이머를 만들지 않는다', async () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    vi.spyOn(global, 'fetch').mockResolvedValue(ok(SEASONAL))

    const { unmount } = renderHook(() => useShuttleSchedule(0, '2026-07-01'))

    // 날짜 고정 조회에는 갱신 인터벌이 붙으면 안 된다.
    const longTimers = setIntervalSpy.mock.calls.filter((c) => c[1] >= 60_000)
    expect(longTimers.length).toBe(0)

    unmount()
  })
})
