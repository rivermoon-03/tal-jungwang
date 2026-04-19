import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// 탭 컴포넌트 mock (테스트 속도 + 의존성 격리)
vi.mock('./components/map/MainTab',      () => ({ default: () => <div>MainTab</div> }))
vi.mock('./components/transit/TransitTab', () => ({ default: () => <div>TransitTab</div> }))
vi.mock('./components/subway/SubwayTab',  () => ({ default: () => <div>SubwayTab</div> }))
vi.mock('./components/more/MoreTab',      () => ({ default: () => <div>MoreTab</div> }))
vi.mock('./components/layout/MainShell',  () => ({ default: () => <div>MainShell</div> }))
vi.mock('./components/layout/BottomDock', () => ({ default: () => <nav>BottomDock</nav> }))
vi.mock('./components/layout/PCNavbar',   () => ({ default: () => <nav>PCNavbar</nav> }))
vi.mock('./components/layout/PWAInstallBanner', () => ({ default: () => null }))
vi.mock('./pages/FavoritesPage', () => ({ default: () => <div>FavoritesPage</div> }))
vi.mock('./pages/SchedulePage',  () => ({ default: () => <div>SchedulePage</div> }))
vi.mock('./pages/MorePage',      () => ({ default: () => <div>MorePage</div> }))
vi.mock('./hooks/useTheme',      () => ({ useTheme: () => {} }))
vi.mock('./hooks/useMore',       () => ({ useNotices: () => ({ data: [] }) }))

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

  it('메인 탭에서 MainShell(모바일)·MainTab(PC) 모두 렌더링', () => {
    render(<App />)
    expect(screen.getByText('MainShell')).toBeInTheDocument()
    expect(screen.getByText('MainTab')).toBeInTheDocument()
  })

  it('BottomDock 은 항상 렌더링됨', () => {
    render(<App />)
    expect(screen.getByText('BottomDock')).toBeInTheDocument()
  })

  it('/favorites 경로에서 FavoritesPage 렌더링', () => {
    setPath('/favorites')
    render(<App />)
    expect(screen.getByText('FavoritesPage')).toBeInTheDocument()
  })

  it('/schedule 경로에서 SchedulePage 렌더링', () => {
    setPath('/schedule')
    render(<App />)
    expect(screen.getByText('SchedulePage')).toBeInTheDocument()
  })

  it('/more 경로에서 MorePage 렌더링', () => {
    setPath('/more')
    render(<App />)
    expect(screen.getByText('MorePage')).toBeInTheDocument()
  })

  it('activeTab=subway 일 때 SubwayTab 렌더링', async () => {
    const useAppStore = (await import('./stores/useAppStore')).default
    vi.mocked(useAppStore).mockImplementation((selector) => selector({
      activeTab: 'subway',
      setActiveTab: vi.fn(),
      setTabBadges: vi.fn(),
    }))
    render(<App />)
    expect(screen.getByText('SubwayTab')).toBeInTheDocument()
  })
})
