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

// useAppStore mock — mapExpanded 토글 + homeView/selectedMode(통짜 스크롤 분기용)
let mockMapExpanded = false
let mockHomeView = 'now'
let mockSelectedMode = 'bus'
const mockToggleMapExpanded = vi.fn(() => { mockMapExpanded = !mockMapExpanded })

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      mapExpanded: mockMapExpanded,
      toggleMapExpanded: mockToggleMapExpanded,
      homeView: mockHomeView,
      selectedMode: mockSelectedMode,
    })
  ),
}))

import MainShell from './MainShell'

describe('MainShell — 시안2 (컴팩트 지도 띠 + Dashboard)', () => {
  beforeEach(() => {
    mockMapExpanded = false
    mockHomeView = 'now'
    mockSelectedMode = 'bus'
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

describe('MainShell — 히어로+대시보드 통짜 스크롤(결함 #31 재발 방지)', () => {
  beforeEach(() => {
    mockMapExpanded = false
    mockHomeView = 'now'
    mockSelectedMode = 'bus'
    mockToggleMapExpanded.mockClear()
  })

  // '지금' 뷰(homeView==='now')에서는 히어로가 고정되지 않는다 — 히어로와
  // Dashboard가 같은 overflow-y-auto 컨테이너 안에 나란히 있어, 스크롤하면
  // 히어로 자체가 카드 목록과 함께 위로 밀려 올라가 사라진다. 이렇게 해야
  // 예전처럼 히어로가 화면을 영구 점유해 Dashboard가 내부 스크롤에 갇히던
  // 결함(#31)이 재발하지 않는다.
  it('"지금" 뷰에서 히어로와 Dashboard가 같은 overflow-y-auto 컨테이너를 공유한다', () => {
    const { container } = render(<MainShell />)

    const dashboard = screen.getByTestId('dashboard')
    // 실제 HomeWeatherHero(모킹하지 않음)의 루트 엘리먼트.
    const hero = container.querySelector('.whero')
    expect(hero).toBeTruthy()

    const scrollContainer = dashboard.closest('.overflow-y-auto')
    expect(scrollContainer).toBeTruthy()
    // 히어로도 같은 스크롤 컨테이너 안에 있어야 스크롤에 함께 실려 사라진다.
    expect(scrollContainer.contains(hero)).toBe(true)
  })

  it('시간표 뷰(homeView==="timetable")에서는 히어로를 숨기고 Dashboard가 내부 스크롤을 전담한다', () => {
    mockHomeView = 'timetable'
    const { container } = render(<MainShell />)

    // 시간표는 상단 그룹 칩을 고정하고 목록만 스크롤하는 자체 레이아웃이라
    // 페이지 전체가 함께 스크롤되면 그 고정 효과가 깨진다 — 이 경우만 예외로
    // 히어로를 숨기고 Dashboard에 남은 높이를 전부 내어준다.
    expect(container.querySelector('.whero')).toBeNull()
    expect(screen.getByTestId('dashboard').closest('.overflow-hidden')).toBeTruthy()
  })

  it('택시 모드는 시간표 개념이 없어 homeView가 timetable이어도 히어로가 통짜 스크롤에 남는다', () => {
    mockHomeView = 'timetable'
    mockSelectedMode = 'taxi'
    const { container } = render(<MainShell />)

    expect(container.querySelector('.whero')).toBeTruthy()
  })
})
