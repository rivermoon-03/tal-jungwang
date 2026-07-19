import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import useMediaQuery, { useIsDesktop, useIsNarrowPhone } from './useMediaQuery'

// jsdom엔 matchMedia가 없어서 쿼리별 matches 값을 반환하는 목(mock)을 구성한다.
// change 리스너를 잡아뒀다가 테스트에서 직접 트리거해 반응형 전환을 검증한다.
function stubMatchMedia(matchesByQuery) {
  const listeners = new Map()
  window.matchMedia = vi.fn().mockImplementation((query) => {
    const mql = {
      matches: matchesByQuery[query] ?? false,
      media: query,
      addEventListener: (event, cb) => {
        if (event === 'change') listeners.set(query, cb)
      },
      removeEventListener: (event) => {
        if (event === 'change') listeners.delete(query)
      },
    }
    return mql
  })
  return {
    trigger(query, matches) {
      matchesByQuery[query] = matches
      listeners.get(query)?.({ matches })
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete window.matchMedia
})

describe('useMediaQuery', () => {
  it('초기 matches 값을 즉시 반환한다', () => {
    stubMatchMedia({ '(max-width: 359px)': true })
    const { result } = renderHook(() => useMediaQuery('(max-width: 359px)'))
    expect(result.current).toBe(true)
  })

  it('change 이벤트 발생 시 값을 갱신한다', () => {
    const { trigger } = stubMatchMedia({ '(max-width: 359px)': false })
    const { result } = renderHook(() => useMediaQuery('(max-width: 359px)'))
    expect(result.current).toBe(false)
    act(() => trigger('(max-width: 359px)', true))
    expect(result.current).toBe(true)
  })

  it('matchMedia 미지원 환경(SSR 등)에서는 false를 반환한다', () => {
    delete window.matchMedia
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })
})

describe('useIsDesktop', () => {
  it('min-width 768px 쿼리로 판정한다', () => {
    stubMatchMedia({ '(min-width: 768px)': true })
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })
})

describe('useIsNarrowPhone', () => {
  it('max-width 359px 미만이면 true', () => {
    stubMatchMedia({ '(max-width: 359px)': true })
    const { result } = renderHook(() => useIsNarrowPhone())
    expect(result.current).toBe(true)
  })

  it('360px 이상이면 false', () => {
    stubMatchMedia({ '(max-width: 359px)': false })
    const { result } = renderHook(() => useIsNarrowPhone())
    expect(result.current).toBe(false)
  })
})
