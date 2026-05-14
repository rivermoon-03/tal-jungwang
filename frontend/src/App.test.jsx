import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// 새 셸 구조에 맞춘 mock (PCMainShell·Dashboard·FloatingDock·PCDock).
vi.mock('./components/layout/MainShell',       () => ({ default: () => <div>MainShell</div> }))
vi.mock('./components/layout/PCMainShell',     () => ({ default: ({ children }) => <div data-testid="pc-main-shell">{children}</div> }))
vi.mock('./components/dashboard/Dashboard',    () => ({ default: () => <div>Dashboard</div> }))
vi.mock('./components/common/FloatingDock',    () => ({ default: () => <nav>FloatingDock</nav> }))
vi.mock('./components/common/PCDock',          () => ({ default: () => <nav>PCDock</nav> }))
vi.mock('./components/layout/PWAInstallBanner', () => ({ default: () => null }))
vi.mock('./pages/SchedulePage',  () => ({ default: () => <div>SchedulePage</div> }))
vi.mock('./pages/CafeteriaPage', () => ({ default: () => <div>CafeteriaPage</div> }))
vi.mock('./pages/MorePage',      () => ({ default: () => <div>MorePage</div> }))
vi.mock('./components/schedule/GlobalDetailModal',          () => ({ default: () => null }))
vi.mock('./components/subway/GlobalSubwayLineSheet',        () => ({ default: () => null }))
vi.mock('./components/subway/GlobalSubwayDetailSheet',      () => ({ default: () => null }))
vi.mock('./hooks/useTheme', () => ({ useTheme: () => {} }))
vi.mock('./hooks/useMore',  () => ({ useNotices: () => ({ data: [] }) }))

vi.mock('./stores/useAppStore', () => ({
  default: vi.fn((selector) => selector({
    activeTab: 'main',
    setActiveTab: vi.fn(),
    setTabBadges: vi.fn(),
  })),
}))

function setPath(pathname) {
  window.history.replaceState({}, '', pathname)
}

describe('App', () => {
  beforeEach(() => {
    setPath('/')
  })

  it('지도(기본) 페이지: 모바일은 MainShell, PC는 PCMainShell+Dashboard 렌더링', () => {
    render(<App />)
    expect(screen.getByText('MainShell')).toBeInTheDocument()
    const pcShell = screen.getByTestId('pc-main-shell')
    expect(pcShell).toBeInTheDocument()
    expect(pcShell).toHaveTextContent('Dashboard')
  })

  it('FloatingDock과 PCDock은 항상 렌더링됨', () => {
    render(<App />)
    expect(screen.getByText('FloatingDock')).toBeInTheDocument()
    expect(screen.getByText('PCDock')).toBeInTheDocument()
  })

  it('/schedule: 모바일은 SchedulePage, PC는 좌측 패널에 SchedulePage', () => {
    setPath('/schedule')
    render(<App />)
    // 모바일 + PC 둘 다 렌더 (CSS로 md:hidden / hidden md:block 토글)
    const all = screen.getAllByText(/SchedulePage/)
    expect(all.length).toBeGreaterThanOrEqual(1)
  })

  it('/cafeteria: CafeteriaPage 렌더링', () => {
    setPath('/cafeteria')
    render(<App />)
    expect(screen.getAllByText(/CafeteriaPage/).length).toBeGreaterThanOrEqual(1)
  })

  it('/more: MorePage 렌더링', () => {
    setPath('/more')
    render(<App />)
    expect(screen.getAllByText(/MorePage/).length).toBeGreaterThanOrEqual(1)
  })
})
