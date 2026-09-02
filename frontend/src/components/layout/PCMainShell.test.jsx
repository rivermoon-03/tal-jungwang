/**
 * PCMainShell — 지도 탭 안에서 "지금 ↔ 시간표"가 제자리 전환되는지 고정한다.
 *
 * 예전에는 사이드바의 "시간표"가 /schedule 로 pushState 했고, 그러면
 * showFloating(=!children) 이 false 가 되면서 도킹 패널이 통째로 unmount 되고
 * 지도 위에 불투명 페이지가 덮였다. PCMapDockPanel 에는 homeView prop 도,
 * 스케줄 컴포넌트 import 도 없어서 지도 탭에 머문 채 시간표가 그려질 코드 경로
 * 자체가 없었다. 모바일 Dashboard 는 같은 일을 SchedulePage embedded 로
 * 제자리 렌더해 이미 올바르게 하고 있었다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PCMainShell from './PCMainShell'

let storeState = {}

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) => selector(storeState)),
}))

vi.mock('../map/MapView', () => ({
  default: () => <div data-testid="map-view">MapView</div>,
}))
vi.mock('../map/MapLegendOnboarding', () => ({
  default: () => <div data-testid="map-legend">Legend</div>,
}))
vi.mock('../map/PCMapDockPanel', () => ({
  default: () => <div data-testid="dock-panel">DockPanel</div>,
}))
vi.mock('../schedule/SchedulePage', () => ({
  default: ({ embedded }) => (
    <div data-testid="schedule-embedded">SchedulePage embedded={String(embedded)}</div>
  ),
}))
vi.mock('../../hooks/useMapBottomCardData', () => ({
  default: () => ({
    routes: [],
    stationLabel: '한국공학대 정문',
    live: false,
    statusLabel: null,
    statusTone: null,
    primary: {},
  }),
}))

describe('PCMainShell', () => {
  beforeEach(() => {
    storeState = {
      selectedMarkerId: null,
      setSelectedMarkerId: vi.fn(),
      homeView: 'now',
      setHomeView: vi.fn(),
    }
  })

  it('지도 홈 · 지금: 도킹 패널과 지도를 함께 그린다', () => {
    render(<PCMainShell />)
    expect(screen.getByTestId('dock-panel')).toBeInTheDocument()
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-embedded')).not.toBeInTheDocument()
  })

  it('지도 홈 · 시간표: 도킹 패널 자리에 시간표가 들어오고 지도는 그대로 남는다', async () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell />)
    // 시간표는 lazy 라 Suspense 해제를 기다린다.
    expect(await screen.findByTestId('schedule-embedded')).toHaveTextContent('embedded=true')
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
    expect(screen.queryByTestId('dock-panel')).not.toBeInTheDocument()
  })

  it('시간표 상태에도 지도를 덮는 불투명 오버레이가 없다', () => {
    storeState.homeView = 'timetable'
    const { container } = render(<PCMainShell />)
    expect(container.querySelector('.absolute.inset-0.z-30')).toBeNull()
  })

  it('시간표 패널 안에 지금/시간표 전환이 붙는다', () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell />)
    expect(screen.getByRole('tab', { name: '지금' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '시간표' })).toHaveAttribute('aria-selected', 'true')
  })

  it('다른 페이지(children 있음)에서는 도킹 패널도 시간표도 뜨지 않는다', () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell><div>FacilitiesPage</div></PCMainShell>)
    expect(screen.queryByTestId('dock-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('schedule-embedded')).not.toBeInTheDocument()
    expect(screen.getByText('FacilitiesPage')).toBeInTheDocument()
    // 지도는 어떤 탭에서도 마운트를 유지한다.
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
  })

  it('시간표 상태에서는 범례 온보딩을 겹쳐 띄우지 않는다', () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell />)
    expect(screen.queryByTestId('map-legend')).not.toBeInTheDocument()
  })
})
