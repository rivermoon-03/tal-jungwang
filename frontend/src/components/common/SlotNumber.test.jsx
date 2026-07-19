import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SlotNumber from './SlotNumber'

describe('SlotNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('숫자 초기값 표시', () => {
    const { container } = render(<SlotNumber value={5} />)
    expect(container.textContent).toContain('5')
  })

  it('값 변경 시 애니메이션 시작 및 완료', () => {
    const { rerender, container } = render(<SlotNumber value={5} />)
    expect(container.textContent).toContain('5')

    rerender(<SlotNumber value={10} />)
    expect(container.textContent).toContain('5')
    expect(container.textContent).toContain('10')

    vi.advanceTimersByTime(400)
    expect(container.textContent).toContain('10')
  })

  it('값 변경 시 글로우 타이머 시작', () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const { rerender } = render(<SlotNumber value={5} />)
    setTimeoutSpy.mockClear()

    rerender(<SlotNumber value={10} />)

    const timeoutCalls = setTimeoutSpy.mock.calls
    const glowTimerCall = timeoutCalls.find((call) => call[1] === 300)
    expect(glowTimerCall).toBeDefined()

    setTimeoutSpy.mockRestore()
  })

  it('prefers-reduced-motion: reduce일 때 잔광 생략', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (query === '(prefers-reduced-motion: reduce)') {
        return { matches: true }
      }
      return { matches: false }
    })

    const { rerender, container } = render(<SlotNumber value={5} />)
    rerender(<SlotNumber value={10} />)

    const span = container.querySelector('span')
    expect(span.className).not.toContain('text-accent-ink')
  })

  it('타이머 클린업 필수', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    const { unmount, rerender } = render(<SlotNumber value={5} />)

    rerender(<SlotNumber value={10} />)
    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('className 병합 유지', () => {
    const { container } = render(<SlotNumber value={5} className="text-large font-bold" />)
    const span = container.querySelector('span')
    expect(span.className).toContain('text-large')
    expect(span.className).toContain('font-bold')
  })
})
