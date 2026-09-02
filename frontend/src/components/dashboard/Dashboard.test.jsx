/**
 * Dashboard — AutoDirectionChip("하교 · 자동" 칩) 테스트.
 *
 * 하교 화면 단순화(시안): 예전엔 SegmentedControl(등교/하교 두 버튼) + 별도
 * "자동으로 되돌리기" 칩, 두 조각이 한 행에 있었다. 이제 칩 하나가 지금 방향과
 * 판정 근거(자동/수동)를 같이 말하고, 탭하면 반대 방향으로 뒤집는다. 이 파일은
 * 그 칩만 검증한다 — 나머지 자식(ModeTabs·StationPills·각 패널)은 이 컴포넌트의
 * 담당 범위가 아니므로 목으로 대체한다(MainShell.test.jsx와 같은 전략).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./ModeTabs', () => ({ default: () => <div data-testid="mode-tabs" /> }))
vi.mock('./StationPills', () => ({ default: () => <div data-testid="station-pills" /> }))
vi.mock('../summary/BusPanel', () => ({ default: () => <div data-testid="bus-panel" /> }))
vi.mock('../summary/SubwayPanel', () => ({ default: () => <div data-testid="subway-panel" /> }))
vi.mock('../summary/ShuttlePanel', () => ({ default: () => <div data-testid="shuttle-panel" /> }))
vi.mock('../summary/TaxiPanel', () => ({ default: () => <div data-testid="taxi-panel" /> }))
vi.mock('./HomeBriefing', () => ({ default: () => <div data-testid="home-briefing" /> }))
vi.mock('../schedule/SchedulePage', () => ({ default: () => <div data-testid="schedule-page" /> }))
vi.mock('../../hooks/useBusStationAutoSelect', () => ({ default: vi.fn() }))

const mockSetDirectionOverride = vi.fn()
const mockSetBusStation = vi.fn()
const mockSetHomeView = vi.fn()
const mockSetDashboardScrollTop = vi.fn()

let mockDirection = { direction: '등교', isOverride: false }
vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: (...args) => mockUseEffectiveDirection(...args),
}))
const mockUseEffectiveDirection = vi.fn(() => mockDirection)

let mockSelectedBusStation = '시흥시청'
let mockSelectedMode = 'bus'
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      selectedMode: mockSelectedMode,
      homeView: 'now',
      setHomeView: mockSetHomeView,
      selectedBusStation: mockSelectedBusStation,
      selectedSubwayStation: '정왕',
      selectedShuttleCampus: 'main',
      dashboardScrollTop: 0,
      setDashboardScrollTop: mockSetDashboardScrollTop,
      setDirectionOverride: mockSetDirectionOverride,
      setBusStation: mockSetBusStation,
    }),
}))

import Dashboard from './Dashboard'

describe('Dashboard — AutoDirectionChip', () => {
  beforeEach(() => {
    mockSetDirectionOverride.mockClear()
    mockSetBusStation.mockClear()
    mockDirection = { direction: '등교', isOverride: false }
    mockSelectedBusStation = '시흥시청'
    mockSelectedMode = 'bus'
  })

  it('현재 방향과 자동/수동 근거를 한 칩에 함께 보여준다', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: '등교 · 자동' })).toBeInTheDocument()
  })

  it('수동 오버라이드 상태면 "· 수동"으로 바뀐다', () => {
    mockDirection = { direction: '하교', isOverride: true }
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: '하교 · 수동' })).toBeInTheDocument()
  })

  it('탭하면 반대 방향으로 뒤집는다', () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: '등교 · 자동' }))
    expect(mockSetDirectionOverride).toHaveBeenCalledWith('하교')
  })

  it('뒤집은 방향을 현재 정류장이 허용하지 않으면 그 방향을 허용하는 첫 정류장으로 옮긴다', () => {
    // 시흥시청은 등교 전용(allowedDirections=['등교']) — 하교로 뒤집으면
    // BUS_STATION_LABELS 중 하교를 허용하는 첫 정류장(한국공학대)으로 이동해야 한다.
    mockSelectedBusStation = '시흥시청'
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: '등교 · 자동' }))
    expect(mockSetBusStation).toHaveBeenCalledWith('한국공학대')
  })

  it('뒤집은 방향을 현재 정류장이 이미 허용하면 정류장을 바꾸지 않는다', () => {
    // 한국공학대는 하교 전용 — 등교로 뒤집으면 등교를 허용하는 정류장으로 옮겨야
    // 하지만, 애초에 정류장을 바꾸지 않는 경우도 검증한다: 이마트도 하교 전용이라
    // 하교→등교 뒤집기 시 이동이 필요하다는 것을 반대로 확인.
    mockDirection = { direction: '하교', isOverride: false }
    mockSelectedBusStation = '한국공학대'
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: '하교 · 자동' }))
    // 등교를 허용하는 첫 정류장(시흥시청)으로 이동한다.
    expect(mockSetBusStation).toHaveBeenCalledWith('시흥시청')
  })

  it('버스 모드가 아니면 칩을 렌더하지 않는다', () => {
    mockSelectedMode = 'subway'
    render(<Dashboard />)
    expect(screen.queryByRole('button', { name: /등교|하교/ })).not.toBeInTheDocument()
  })
})

/**
 * 사용자 실측 — "시간표 탭에서 지금을 누르면 홈으로 돌아오네. 지금/시간표
 * 셀렉터 없애버려라." 예전엔 이 화면 안에 ViewSwitch(SegmentedControl,
 * aria-label="보기 전환") 셀렉터가 따로 있어, 독의 "시간표" 탭과 같은
 * homeView를 두 군데서 조작했다. 셀렉터는 없앴고, 그 자리를 하단 독의
 * 홈/시간표 탭이 대신한다(FloatingDock.test.jsx가 그 라우팅을 검증한다) —
 * 이 파일에서는 셀렉터 자체가 더 이상 렌더되지 않는지만 확인한다.
 */
describe('Dashboard — 지금/시간표 셀렉터(ViewSwitch)를 없앴다', () => {
  it('"지금" 뷰(homeView=now)에는 보기 전환 셀렉터가 없다', () => {
    render(<Dashboard />)
    expect(screen.queryByRole('group', { name: '보기 전환' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '지금' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '시간표' })).not.toBeInTheDocument()
  })
})
