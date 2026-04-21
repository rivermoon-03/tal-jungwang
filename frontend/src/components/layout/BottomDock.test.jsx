import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import BottomDock from './BottomDock'

function setPathname(pathname) {
  window.history.replaceState({}, '', pathname)
}

describe('BottomDock', () => {
  beforeEach(() => {
    setPathname('/')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    setPathname('/')
  })

  it('4개 탭 라벨 모두 렌더링', () => {
    render(<BottomDock />)
    expect(screen.getByText('지도')).toBeInTheDocument()
    expect(screen.getByText('시간표')).toBeInTheDocument()
    expect(screen.getByText('통계')).toBeInTheDocument()
    expect(screen.getByText('더보기')).toBeInTheDocument()
  })

  it('네비게이션 랜드마크에 aria-label이 붙는다', () => {
    render(<BottomDock />)
    expect(screen.getByRole('navigation', { name: '하단 탭 메뉴' })).toBeInTheDocument()
  })

  it('pathname=/ 이면 지도 탭이 aria-current="page"', () => {
    setPathname('/')
    render(<BottomDock />)
    expect(screen.getByRole('link', { name: '지도' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '시간표' })).not.toHaveAttribute('aria-current')
  })

  it('pathname=/stats 이면 통계 탭이 active', () => {
    setPathname('/stats')
    render(<BottomDock />)
    expect(screen.getByRole('link', { name: '통계' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '지도' })).not.toHaveAttribute('aria-current')
  })

  it('pathname=/schedule 이면 시간표 탭이 active', () => {
    setPathname('/schedule')
    render(<BottomDock />)
    expect(screen.getByRole('link', { name: '시간표' })).toHaveAttribute('aria-current', 'page')
  })

  it('알 수 없는 경로면 지도 탭이 기본 active', () => {
    setPathname('/unknown')
    render(<BottomDock />)
    expect(screen.getByRole('link', { name: '지도' })).toHaveAttribute('aria-current', 'page')
  })

  it('탭 클릭 시 window.history.pushState가 호출된다', () => {
    setPathname('/')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    render(<BottomDock />)

    fireEvent.click(screen.getByRole('link', { name: '통계' }))

    expect(pushSpy).toHaveBeenCalledWith({}, '', '/stats')
  })

  it('현재 경로와 동일한 탭 클릭 시 pushState가 호출되지 않는다', () => {
    setPathname('/stats')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    render(<BottomDock />)

    fireEvent.click(screen.getByRole('link', { name: '통계' }))

    expect(pushSpy).not.toHaveBeenCalled()
  })
})
