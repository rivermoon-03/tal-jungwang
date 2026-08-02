import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import FloatingDock from './FloatingDock'

vi.mock('../../hooks/usePathname', () => ({
  default: vi.fn(() => '/'),
}))

describe('FloatingDock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      vibrate: vi.fn(),
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('탭 4개(홈/학교시설/공지/더보기) aria-label + 시각 텍스트 라벨(12px)', () => {
    render(<FloatingDock />)
    expect(screen.getByLabelText('홈')).toBeInTheDocument()
    expect(screen.getByLabelText('학교시설')).toBeInTheDocument()
    expect(screen.getByLabelText('공지')).toBeInTheDocument()
    expect(screen.getByLabelText('더보기')).toBeInTheDocument()
    // 결함 #31 수정 — 아이콘 아래 시각 텍스트 라벨이 보여야 한다.
    expect(screen.getAllByText('학교시설').length).toBeGreaterThan(0)
    expect(screen.queryByText('지도')).toBeNull()
  })

  it('홈 탭 롱프레스 타이머 500ms 설정', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    setTimeoutSpy.mockClear()
    fireEvent.pointerDown(scheduleTab)

    const calls = setTimeoutSpy.mock.calls
    expect(calls.some((call) => call[1] === 500)).toBe(true)

    setTimeoutSpy.mockRestore()
  })

  it('롱프레스 발동 시 navigator.vibrate 호출', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(scheduleTab)
    vi.advanceTimersByTime(500)

    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('pointerUp 시 롱프레스 타이머 해제', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(scheduleTab)
    vi.advanceTimersByTime(300)
    fireEvent.pointerUp(scheduleTab)
    vi.advanceTimersByTime(200)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })

  it('pointerLeave 시 롱프레스 타이머 해제', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(scheduleTab)
    vi.advanceTimersByTime(300)
    fireEvent.pointerLeave(scheduleTab)
    vi.advanceTimersByTime(200)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })

  it('pointerCancel 시 롱프레스 타이머 해제', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(scheduleTab)
    vi.advanceTimersByTime(300)
    fireEvent.pointerCancel(scheduleTab)
    vi.advanceTimersByTime(200)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })

  it('롱프레스 발동 후 longPressTriggered 플래그 설정', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(scheduleTab)
    vi.advanceTimersByTime(500)

    const event = new MouseEvent('click', { bubbles: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    scheduleTab.dispatchEvent(event)

    expect(preventDefaultSpy).toBeDefined()
  })

  it('홈 탭 contextMenu 기본 동작 방지', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')

    const event = new Event('contextmenu', { bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    scheduleTab.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('홈 탭 touch-action: none 설정', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('홈')
    const link = scheduleTab.closest('a')

    expect(link).toHaveStyle({ touchAction: 'none' })
  })

  it('기타 탭은 롱프레스 리스너 없음', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(homeTab)
    vi.advanceTimersByTime(500)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })
})
