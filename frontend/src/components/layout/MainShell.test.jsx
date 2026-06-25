/**
 * MainShell 시안2 구조 테스트
 *
 * 시안2: 상단 컴팩트 지도 띠(~110px) + 우측 지도 확장 버튼 + 아래 Dashboard 전체.
 * 기존 2단 스냅(SnapHandle) 제거.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// MapView: 카카오 SDK 없이도 렌더 가능하도록 mock
vi.mock('../map/MapView', () => ({
  default: () => <div data-testid="map-view">MapView</div>,
}))

// Dashboard mock
vi.mock('../dashboard/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}))

// useAppStore mock — mapExpanded 토글용
let mockMapExpanded = false
const mockToggleMapExpanded = vi.fn(() => { mockMapExpanded = !mockMapExpanded })

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      mapExpanded: mockMapExpanded,
      toggleMapExpanded: mockToggleMapExpanded,
    })
  ),
}))

import MainShell from './MainShell'

describe('MainShell — 시안2 (컴팩트 지도 띠 + Dashboard)', () => {
  beforeEach(() => {
    mockMapExpanded = false
    mockToggleMapExpanded.mockClear()
  })

  it('MapView를 렌더한다', () => {
    render(<MainShell />)
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
  })

  it('Dashboard를 렌더한다', () => {
    render(<MainShell />)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })

  it('지도 확장 버튼이 존재한다', () => {
    render(<MainShell />)
    const btn = screen.getByRole('button', { name: /지도/ })
    expect(btn).toBeInTheDocument()
  })

  it('지도 확장 버튼 클릭 시 toggleMapExpanded가 호출된다', () => {
    render(<MainShell />)
    const btn = screen.getByRole('button', { name: /지도/ })
    fireEvent.click(btn)
    expect(mockToggleMapExpanded).toHaveBeenCalledTimes(1)
  })

  it('SnapHandle(스냅 핸들)이 없다', () => {
    render(<MainShell />)
    // SnapHandle은 role="separator" aria-label="지도·대시보드 구분선"으로 렌더됨
    const snapHandle = screen.queryByRole('separator')
    expect(snapHandle).not.toBeInTheDocument()
  })
})
