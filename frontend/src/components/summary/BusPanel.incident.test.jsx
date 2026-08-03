/**
 * B3 — 통학축 돌발상황 배너·경로 경고 칩 테스트.
 *
 * 규칙: 인시던트가 있으면 패널 상단 amber 배너(+베타 표기)와 express 카드의
 * warn 칩만 추가된다. 없거나 API가 저하되면 아무것도 안 보인다(빈 상태 UI 금지).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BusPanel from './BusPanel'

const mocks = vi.hoisted(() => ({ station: '시흥시청' }))

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedBusStation: mocks.station,
      selectedBusDirection: '등교',
      selectedMode: 'bus',
      setDetailModal: vi.fn(),
      setSelectedMode: vi.fn(),
    })
  ),
}))

vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: vi.fn(() => ({ direction: '등교' })),
}))

const mockUseBusArrivals = vi.fn()
const mockUseBusRoutesByCategory = vi.fn()

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: (...args) => mockUseBusArrivals(...args),
  useBusRoutesByCategory: (...args) => mockUseBusRoutesByCategory(...args),
  useBusTimetable: vi.fn(() => ({ data: null, loading: false, error: null, refetch: vi.fn() })),
  useBusTimetableByRoute: vi.fn(() => ({ data: { times: [] }, loading: false, error: null, refetch: vi.fn() })),
}))

// 실제 useApi 폴링이 테스트에서 돌지 않게 제보 훅도 모킹한다
vi.mock('../../hooks/useBusReports', () => ({
  useActiveBusReports: vi.fn(() => ({ data: { items: [] }, loading: false, error: null, refetch: vi.fn() })),
  busReportChipLabel: vi.fn(() => ''),
}))

const mockUseTrafficIncidents = vi.fn()
vi.mock('../../hooks/useTrafficIncidents', () => ({
  useTrafficIncidents: (...args) => mockUseTrafficIncidents(...args),
}))

const ACCIDENT = {
  type: 'accident',
  road_name: '서해안로',
  message: '3중 추돌사고',
  occurred_at: '2026-08-03T14:05:00+09:00',
}

const CONSTRUCTION = {
  type: 'construction',
  road_name: '서해안로',
  message: '차로 축소 공사',
  occurred_at: '2026-08-03T09:00:00+09:00',
}

/** routeNo 하나가 실시간 운행 중인 arrivals 응답. 3401=광역(express), 5602=간선. */
function arrivalsWith(routeNo = '3401') {
  mockUseBusArrivals.mockReturnValue({
    data: {
      arrivals: [
        {
          route_id: 10,
          route_no: routeNo,
          destination: '학교행',
          category: '등교',
          arrival_type: 'realtime',
          depart_at: null,
          arrive_in_seconds: 600,
          is_tomorrow: false,
          crowded: 0,
        },
      ],
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
}

beforeEach(() => {
  mocks.station = '시흥시청'
  mockUseTrafficIncidents.mockReturnValue({ incidents: [] })
  mockUseBusRoutesByCategory.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
  arrivalsWith('3401')
})

describe('BusPanel — 돌발 배너 (B3)', () => {
  it('사고 인시던트가 있으면 도로명·유형·확인 시각이 담긴 배너가 보인다', () => {
    mockUseTrafficIncidents.mockReturnValue({ incidents: [ACCIDENT] })
    render(<BusPanel />)

    expect(screen.getByText(/서해안로 사고 · 서울 방면 광역버스 지연 가능 · 14:05 확인/)).toBeInTheDocument()
  })

  it('배너 안에 베타 표기가 있다', () => {
    mockUseTrafficIncidents.mockReturnValue({ incidents: [ACCIDENT] })
    render(<BusPanel />)

    // 좌석·정거장 칩이 없는 시나리오라 베타는 배너의 것 하나뿐이어야 한다
    expect(screen.getAllByText('베타')).toHaveLength(1)
  })

  it('공사 유형이면 배너와 칩이 공사로 표기된다', () => {
    mockUseTrafficIncidents.mockReturnValue({ incidents: [CONSTRUCTION] })
    render(<BusPanel />)

    expect(screen.getByText(/서해안로 공사 · 서울 방면 광역버스 지연 가능 · 09:00 확인/)).toBeInTheDocument()
    expect(screen.getByText('경로 공사')).toBeInTheDocument()
  })

  it('인시던트가 없으면 배너·칩 어느 것도 그리지 않는다(빈 상태 UI 금지)', () => {
    render(<BusPanel />)

    expect(screen.queryByText(/지연 가능/)).not.toBeInTheDocument()
    expect(screen.queryByText('경로 사고')).not.toBeInTheDocument()
    expect(screen.queryByText('경로 공사')).not.toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
  })

  it('서울 정류장(시간표 전용 분기)에서도 배너는 패널 상단에 보인다', () => {
    mocks.station = '서울'
    mockUseTrafficIncidents.mockReturnValue({ incidents: [ACCIDENT] })
    render(<BusPanel />)

    expect(screen.getByText(/서해안로 사고/)).toBeInTheDocument()
  })
})

describe('BusPanel — express 경로 경고 칩 (B3)', () => {
  it('광역(express) 노선 카드에는 "경로 사고" warn 칩이 붙는다', () => {
    mockUseTrafficIncidents.mockReturnValue({ incidents: [ACCIDENT] })
    arrivalsWith('3401')
    render(<BusPanel />)

    expect(screen.getByText('경로 사고')).toBeInTheDocument()
  })

  it('비광역 노선(5602 간선)에는 경로 칩을 붙이지 않는다', () => {
    mockUseTrafficIncidents.mockReturnValue({ incidents: [ACCIDENT] })
    arrivalsWith('5602')
    render(<BusPanel />)

    // 배너는 있어도 카드 칩은 없다
    expect(screen.getByText(/서해안로 사고/)).toBeInTheDocument()
    expect(screen.queryByText('경로 사고')).not.toBeInTheDocument()
  })

  it('모르는 유형의 인시던트만 오면 배너·칩을 그리지 않는다', () => {
    mockUseTrafficIncidents.mockReturnValue({
      incidents: [{ type: 'weather', road_name: '서해안로', message: '안개', occurred_at: null }],
    })
    render(<BusPanel />)

    expect(screen.queryByText(/지연 가능/)).not.toBeInTheDocument()
    expect(screen.queryByText(/경로 /)).not.toBeInTheDocument()
  })
})
