import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useApi, apiFetch, invalidateApiCache } from './useApi'

// 백엔드 응답 shape: { success, data, error }
function ok(data) {
  return {
    ok: true,
    json: async () => ({ success: true, data }),
  }
}

beforeEach(() => {
  invalidateApiCache()
  vi.restoreAllMocks()
  vi.useRealTimers()
  // 항상 보이는 상태로 시작(visibilitychange 분기 안정화).
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('apiFetch', () => {
  it('throws on non-ok with status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 })
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 503 })
  })

  it('throws on success:false with code', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: { message: 'nope', code: 'E' } }),
    })
    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'E' })
  })
})

describe('useApi public API contract', () => {
  it('exposes { data, loading, error, fetchedAt, refetch }', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(ok({ v: 1 }))
    const { result } = renderHook(() => useApi('/contract'))
    expect(result.current).toHaveProperty('loading')
    expect(typeof result.current.refetch).toBe('function')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ v: 1 })
    expect(result.current.error).toBe(null)
    expect(typeof result.current.fetchedAt).toBe('number')
  })

  it('enabled=false does not fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok({ v: 1 }))
    const { result } = renderHook(() => useApi('/disabled', { enabled: false }))
    await Promise.resolve()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe(null)
  })
})

describe('in-flight dedup', () => {
  it('coalesces concurrent same-path mounts into 1 network call', async () => {
    let resolve
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      () => new Promise((r) => { resolve = r }),
    )
    const a = renderHook(() => useApi('/same'))
    const b = renderHook(() => useApi('/same'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve(ok({ v: 9 }))
      await Promise.resolve()
    })
    await waitFor(() => expect(a.result.current.data).toEqual({ v: 9 }))
    await waitFor(() => expect(b.result.current.data).toEqual({ v: 9 }))
  })
})

describe('ttl cache hit', () => {
  it('second mount within ttl reuses cache, no extra fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok({ v: 5 }))
    const first = renderHook(() => useApi('/ttl', { ttl: 10000 }))
    await waitFor(() => expect(first.result.current.data).toEqual({ v: 5 }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useApi('/ttl', { ttl: 10000 }))
    // 캐시 히트 → 즉시 data, loading=false, 추가 fetch 없음.
    expect(second.result.current.data).toEqual({ v: 5 })
    expect(second.result.current.loading).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('path change resets to loading/null', () => {
  it('clears data and sets loading when path changes (시흥1 폴백 회귀)', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/p1')) return Promise.resolve(ok({ p: 1 }))
      // p2는 영원히 pending → 전환 직후 loading=true, data=null 검증
      return new Promise(() => {})
    })
    const { result, rerender } = renderHook(({ path }) => useApi(path), {
      initialProps: { path: '/p1' },
    })
    await waitFor(() => expect(result.current.data).toEqual({ p: 1 }))

    act(() => rerender({ path: '/p2' }))
    expect(result.current.data).toBe(null)
    expect(result.current.loading).toBe(true)
  })
})

describe('path-level single scheduler (#5)', () => {
  it('uses one timer for N subscribers of same (path, interval) and broadcasts', async () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok({ t: 1 }))

    const a = renderHook(() => useApi('/poll', { interval: 1000 }))
    const b = renderHook(() => useApi('/poll', { interval: 1000 }))
    const c = renderHook(() => useApi('/poll', { interval: 1000 }))

    // 초기 fetch는 인스턴스별 1회씩 일어날 수 있으나(dedup으로 네트워크는 1),
    // 폴링 타이머는 (path, interval)당 1개여야 한다.
    const pollTimers = setIntervalSpy.mock.calls.filter((c) => c[1] === 1000)
    expect(pollTimers.length).toBe(1)

    fetchSpy.mockClear()
    // 한 틱 → 단일 fetchDedup → 모든 구독자 broadcast
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(a.result.current.data).toEqual({ t: 1 })
    expect(b.result.current.data).toEqual({ t: 1 })
    expect(c.result.current.data).toEqual({ t: 1 })

    a.unmount(); b.unmount(); c.unmount()
  })

  it('tears down timer when last subscriber unmounts', async () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    vi.spyOn(global, 'fetch').mockResolvedValue(ok({ t: 1 }))

    const a = renderHook(() => useApi('/teardown', { interval: 1000 }))
    const b = renderHook(() => useApi('/teardown', { interval: 1000 }))

    a.unmount()
    // 아직 b가 구독 중 → 타이머 유지(clearInterval 호출 후에도 살아있어야 함)
    clearIntervalSpy.mockClear()
    b.unmount()
    // 마지막 구독자 해제 → 타이머 정리
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('enabled=false instance does not subscribe to scheduler', async () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    vi.spyOn(global, 'fetch').mockResolvedValue(ok({ t: 1 }))

    renderHook(() => useApi('/off', { interval: 1000, enabled: false }))
    const pollTimers = setIntervalSpy.mock.calls.filter((c) => c[1] === 1000)
    expect(pollTimers.length).toBe(0)
  })
})

describe('LRU cache eviction (#6)', () => {
  it('evicts oldest entries beyond CACHE_MAX so cache hits expire', async () => {
    vi.useRealTimers()
    // 동기적으로 resolve되는 fetch — apiFetch 한 번이면 cache.set이 채워진다.
    vi.spyOn(global, 'fetch').mockImplementation((url) =>
      Promise.resolve(ok({ url: String(url) })),
    )
    const ttl = 60_000

    // CACHE_MAX(100)를 넘기도록 서로 다른 path 0..120(=121개)을 캐시에 채운다.
    // useApi 마운트가 fetchDedup→cache.set 경로를 태운다. 한 번에 마운트하고
    // 마이크로태스크를 1회 flush 하면 모든 fetch가 resolve되어 캐시에 채워진다.
    await act(async () => {
      for (let i = 0; i <= 120; i++) renderHook(() => useApi(`/lru/${i}`, { ttl }))
      // 모든 fetch promise(.then→cache.set)가 정착하도록 충분히 flush.
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))
    })

    // /lru/0 은 가장 오래된 것으로 evict 되었어야 한다 → 캐시 미스 → loading=true.
    const evicted = renderHook(() => useApi('/lru/0', { ttl }))
    expect(evicted.result.current.loading).toBe(true)

    // 반대로 최근 path는 여전히 캐시 히트(loading=false, 즉시 data).
    const recent = renderHook(() => useApi('/lru/120', { ttl }))
    expect(recent.result.current.loading).toBe(false)
    expect(recent.result.current.data).toBeTruthy()
  })
})
