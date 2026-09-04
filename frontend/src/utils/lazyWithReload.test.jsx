/**
 * lazyWithReload — App.jsx에만 있던 지역 함수를 MapView 청크 분리(2026-09)
 * 계기로 공용 유틸로 뽑았다. 동작 자체는 옮기기 전과 같아야 한다 — import가
 * 성공하면 리로드 가드를 지우고, 실패하면 세션당 1회만 새로고침 후 에러를
 * 다시 던지는지 고정한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { lazyWithReload } from './lazyWithReload'
import { hasReloadedForChunkError, clearReloadGuard } from './chunkReload'

describe('lazyWithReload', () => {
  let reloadSpy

  beforeEach(() => {
    sessionStorage.clear()
    // jsdom의 window.location.reload는 기본 설정으로 재정의가 안 된다
    // (Cannot redefine property) — location 객체 자체를 갈아 끼운다.
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('import가 성공하면 리로드 가드를 지우고 컴포넌트를 렌더한다', async () => {
    clearReloadGuard()
    const LazyOk = lazyWithReload(() =>
      Promise.resolve({ default: () => <div data-testid="ok">ok</div> })
    )
    render(
      <Suspense fallback={<div>loading</div>}>
        <LazyOk />
      </Suspense>
    )
    expect(await screen.findByTestId('ok')).toBeInTheDocument()
    expect(hasReloadedForChunkError()).toBe(false)
  })

  it('import가 처음 실패하면 가드를 세우고 새로고침을 1회 호출한다', async () => {
    clearReloadGuard()
    const LazyFail = lazyWithReload(() => Promise.reject(new Error('chunk load failed')))
    render(
      <Suspense fallback={<div>loading</div>}>
        <LazyFail />
      </Suspense>
    )
    // catch 체인이 마이크로태스크로 처리될 시간을 준다.
    await new Promise((r) => setTimeout(r, 0))
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(hasReloadedForChunkError()).toBe(true)
  })
})
