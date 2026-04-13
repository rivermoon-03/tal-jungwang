import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

// Mock all tab components to keep tests fast
vi.mock('./components/map/MainTab', () => ({ default: () => <div>MainTab</div> }))
vi.mock('./components/shuttle/ShuttleTab', () => ({ default: () => <div>ShuttleTab</div> }))
vi.mock('./components/bus/BusTab', () => ({ default: () => <div>BusTab</div> }))
vi.mock('./components/subway/SubwayTab', () => ({ default: () => <div>SubwayTab</div> }))
vi.mock('./components/layout/MobileTabBar', () => ({ default: () => <nav>MobileTabBar</nav> }))
vi.mock('./components/layout/PCSidebar', () => ({ default: () => <aside>PCSidebar</aside> }))
vi.mock('./stores/useAppStore', () => ({
  default: vi.fn((selector) => selector({
    activeTab: 'main',
    setActiveTab: vi.fn(),
  })),
}))

describe('App', () => {
  it('기본 탭(메인)이 표시됨', () => {
    render(<App />)
    expect(screen.getByText('MainTab')).toBeInTheDocument()
  })

  it('MobileTabBar와 PCSidebar가 모두 렌더링됨', () => {
    render(<App />)
    expect(screen.getByText('MobileTabBar')).toBeInTheDocument()
    expect(screen.getByText('PCSidebar')).toBeInTheDocument()
  })

  it('activeTab이 shuttle일 때 ShuttleTab이 표시됨', async () => {
    // Override the mock store to return 'shuttle'
    const useAppStore = (await import('./stores/useAppStore')).default
    vi.mocked(useAppStore).mockImplementation((selector) => selector({
      activeTab: 'shuttle',
      setActiveTab: vi.fn(),
    }))
    render(<App />)
    expect(screen.getByText('ShuttleTab')).toBeInTheDocument()
  })
})
