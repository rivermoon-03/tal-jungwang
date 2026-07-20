import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// 새 셸 구조에 맞춘 mock (PCMainShell·PCSidebar·Dashboard·FloatingDock).
// 데스크톱 리디자인 이후 PCDock/PCMapDashboard는 App.jsx에서 더 이상 마운트하지 않는다.
vi.mock('./components/layout/MainShell',       () => ({ default: () => <div>MainShell</div> }))
vi.mock('./components/layout/PCMainShell',     () => ({ default: ({ children }) => <div data-testid="pc-main-shell">{children}</div> }))
vi.mock('./components/layout/PCSidebar',       () => ({ default: () => <nav>PCSidebar</nav> }))
vi.mock('./components/dashboard/Dashboard',    () => ({ default: () => <div>Dashboard</div> }))
vi.mock('./components/common/FloatingDock',    () => ({ default: () => <nav>FloatingDock</nav> }))
vi.mock('./components/layout/PWAInstallBanner', () => ({ default: () => null }))
vi.mock('./components/search/SearchOverlay',   () => ({ default: () => null }))
vi.mock('./pages/SchedulePage',  () => ({ default: () => <div>SchedulePage</div> }))
vi.mock('./pages/CafeteriaPage', () => ({ default: () => <div>CafeteriaPage</div> }))
vi.mock('./pages/MorePage',      () => ({ default: () => <div>MorePage</div> }))
vi.mock('./components/schedule/GlobalDetailModal',          () => ({ default: () => null }))
vi.mock('./components/subway/GlobalSubwayLineSheet',        () => ({ default: () => null }))
vi.mock('./components/subway/GlobalSubwayDetailSheet',      () => ({ default: () => null }))
vi.mock('./hooks/useTheme', () => ({ useTheme: () => {} }))
vi.mock('./hooks/useMore',  () => ({ useNotices: () => ({ data: [] }) }))
vi.mock('./pages/RouteDetailPage', () => ({ default: ({ routeNumber }) => <div data-testid="route-detail-page">RouteDetailPage-{routeNumber}</div> }))
vi.mock('./pages/CafeteriaVenueDetailPage', () => ({ default: ({ venueId }) => <div data-testid="cafeteria-venue-detail-page">CafeteriaVenueDetailPage-{venueId}</div> }))
vi.mock('./hooks/useMediaQuery', () => ({
  default: () => false,
  useIsDesktop: () => isDesktopMock,
}))

let isDesktopMock = false

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
    isDesktopMock = false
  })

  it('지도(기본) 페이지 · 모바일: MainShell만 마운트', () => {
    isDesktopMock = false
    render(<App />)
    expect(screen.getByText('MainShell')).toBeInTheDocument()
    expect(screen.queryByTestId('pc-main-shell')).not.toBeInTheDocument()
  })

  it('지도(기본) 페이지 · PC: PCMainShell이 children=null로 마운트(풀사이즈 지도+플로팅)', () => {
    isDesktopMock = true
    render(<App />)
    expect(screen.queryByText('MainShell')).not.toBeInTheDocument()
    const pcShell = screen.getByTestId('pc-main-shell')
    expect(pcShell).toBeInTheDocument()
    expect(pcShell).toHaveTextContent('')
  })

  it('모바일: FloatingDock만 마운트, PCSidebar 없음', () => {
    isDesktopMock = false
    render(<App />)
    expect(screen.getByText('FloatingDock')).toBeInTheDocument()
    expect(screen.queryByText('PCSidebar')).not.toBeInTheDocument()
  })

  it('PC: PCSidebar만 마운트, FloatingDock 없음', () => {
    isDesktopMock = true
    render(<App />)
    expect(screen.getByText('PCSidebar')).toBeInTheDocument()
    expect(screen.queryByText('FloatingDock')).not.toBeInTheDocument()
  })

  // 페이지들은 lazy 로드라 Suspense fallback 이후 비동기로 나타난다 → findAllByText로 대기.
  it('/schedule: 모바일은 SchedulePage, PC는 좌측 패널에 SchedulePage', async () => {
    setPath('/schedule')
    render(<App />)
    // 모바일 + PC 둘 다 렌더 (CSS로 md:hidden / hidden md:block 토글)
    const all = await screen.findAllByText(/SchedulePage/)
    expect(all.length).toBeGreaterThanOrEqual(1)
  })

  it('/cafeteria: CafeteriaPage 렌더링', async () => {
    setPath('/cafeteria')
    render(<App />)
    expect((await screen.findAllByText(/CafeteriaPage/)).length).toBeGreaterThanOrEqual(1)
  })

  it('/more: MorePage 렌더링', async () => {
    setPath('/more')
    render(<App />)
    expect((await screen.findAllByText(/MorePage/)).length).toBeGreaterThanOrEqual(1)
  })

  it('/route/bus:33: RouteDetailPage 렌더링 + routeNumber=33 전달', async () => {
    setPath('/route/bus:33')
    render(<App />)
    const el = await screen.findByTestId('route-detail-page')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('RouteDetailPage-33')
  })

  it('/route/33: prefix 없이 routeNumber=33 전달', async () => {
    setPath('/route/33')
    render(<App />)
    const el = await screen.findByTestId('route-detail-page')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('RouteDetailPage-33')
  })

  it('/cafeteria/student-cafeteria: CafeteriaVenueDetailPage 렌더링 + venueId 전달', async () => {
    setPath('/cafeteria/student-cafeteria')
    render(<App />)
    const el = await screen.findByTestId('cafeteria-venue-detail-page')
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('CafeteriaVenueDetailPage-student-cafeteria')
  })

  it('/cafeteria (슬래시 없음): 기존 CafeteriaPage 그대로 렌더링', async () => {
    setPath('/cafeteria')
    render(<App />)
    expect((await screen.findAllByText(/CafeteriaPage/)).length).toBeGreaterThanOrEqual(1)
  })

  it('/cafeteria/gs25: venueId=gs25 전달 (URL 인코딩된 id)', async () => {
    setPath('/cafeteria/gs25')
    render(<App />)
    const el = await screen.findByTestId('cafeteria-venue-detail-page')
    expect(el).toHaveTextContent('CafeteriaVenueDetailPage-gs25')
  })

  // main을 감싸는 flex-col wrapper에 min-h-0이 없으면, flex item의 기본
  // min-height:auto 때문에 콘텐츠가 길어질 때 이 div가 뷰포트 높이를 넘어
  // 늘어나 버린다. html/body/#root는 overflow:hidden(index.css)이라 이 늘어난
  // 콘텐츠는 어디서도 스크롤할 수 없게 된다 — 모바일 세로 스크롤 불가 회귀.
  it('main 래퍼 div: min-h-0 있어야 함 (없으면 긴 콘텐츠에서 스크롤 불가)', () => {
    isDesktopMock = false
    const { container } = render(<App />)
    const wrapper = container.querySelector('main').parentElement
    expect(wrapper.className).toContain('min-h-0')
  })
})
