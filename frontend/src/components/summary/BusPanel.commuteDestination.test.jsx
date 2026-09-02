/**
 * 하교 화면 단순화(시안) — "내 목적지" 큰 카드 1장 + 접힌 "다른 목적지 N곳".
 *
 * 규칙:
 *  - 하교 방향(비서울 정류장)에서만 적용된다. 등교는 기존 목록 그대로.
 *  - favorites.keys(favKey.js 스키마, "bus:노선번호:하교")에 일치하는 노선이 있으면
 *    그 노선이 size='lg' 큰 카드로 "내 목적지" 자리에 오고, 나머지는 전부
 *    "다른 목적지 N곳" 접힘 목록(기본 접힘) 안으로 들어간다.
 *  - 아직 하교 노선을 즐겨찾기하지 않았으면 "내 목적지" 자리에 안내 카드가 뜬다.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BusPanel from './BusPanel'

const mocks = vi.hoisted(() => ({ station: '한국공학대', favKeys: [], direction: '하교' }))

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedBusStation: mocks.station,
      selectedBusDirection: mocks.direction,
      selectedMode: 'bus',
      setDetailModal: vi.fn(),
      setSelectedMode: vi.fn(),
      favorites: { keys: mocks.favKeys },
    })
  ),
}))

vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: vi.fn(() => ({ direction: mocks.direction })),
}))

const mockUseBusArrivals = vi.fn()

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: (...args) => mockUseBusArrivals(...args),
  useBusRoutesByCategory: vi.fn(() => ({ data: [], loading: false, error: null, refetch: vi.fn() })),
  useBusTimetable: vi.fn(() => ({ data: null, loading: false, error: null, refetch: vi.fn() })),
  useBusTimetableByRoute: vi.fn(() => ({ data: { times: [] }, loading: false, error: null, refetch: vi.fn() })),
}))

/** 실시간 도착이 잡힌 두 노선. 20-1이 더 빨리 온다(300초 < 900초). */
const TWO_LIVE_ROUTES = [
  {
    route_id: 1,
    route_no: '20-1',
    destination: '정왕역행',
    category: '하교',
    arrival_type: 'realtime',
    arrive_in_seconds: 300,
    is_tomorrow: false,
  },
  {
    route_id: 2,
    route_no: '11-A',
    destination: '시흥시청행',
    category: '하교',
    arrival_type: 'realtime',
    arrive_in_seconds: 900,
    is_tomorrow: false,
  },
]

beforeEach(() => {
  mocks.station = '한국공학대'
  mocks.favKeys = []
  mocks.direction = '하교'
  mockUseBusArrivals.mockReturnValue({
    data: { arrivals: TWO_LIVE_ROUTES },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('BusPanel — 하교 "내 목적지" 안내 카드(즐겨찾기 없음)', () => {
  it('아직 목적지를 정하지 않았다는 안내 카드를 보여준다', () => {
    render(<BusPanel />)

    expect(screen.getByText('아직 목적지를 정하지 않았어요')).toBeInTheDocument()
  })

  it('노선 카드는 "다른 목적지" 접힘 안에 있어 기본적으로 보이지 않는다', () => {
    render(<BusPanel />)

    expect(screen.queryByRole('button', { name: /20-1/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /다른 목적지 · 2곳/ })).toBeInTheDocument()
  })

  it('"다른 목적지"를 탭하면 노선 카드가 펼쳐진다', () => {
    render(<BusPanel />)

    fireEvent.click(screen.getByRole('button', { name: /다른 목적지/ }))

    expect(screen.getByRole('button', { name: /20-1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /11-A/ })).toBeInTheDocument()
  })

  it('안내 카드를 누르면 "다른 목적지"가 곧바로 펼쳐진다', () => {
    render(<BusPanel />)

    fireEvent.click(screen.getByText('아직 목적지를 정하지 않았어요'))

    expect(screen.getByRole('button', { name: /20-1/ })).toBeInTheDocument()
  })
})

describe('BusPanel — 하교 "내 목적지" 큰 카드(즐겨찾기 있음)', () => {
  it('즐겨찾기한 노선이 "내 목적지" 자리에 크게(size=lg) 뜨고, 접힘 목록에는 없다', () => {
    mocks.favKeys = ['bus:11-A:하교']
    render(<BusPanel />)

    // "내 목적지" 자리 — 접지 않아도 바로 보인다.
    const primaryCard = screen.getByRole('button', { name: /11-A/ })
    expect(primaryCard).toHaveAttribute('data-size', 'lg')
    expect(screen.queryByText('아직 목적지를 정하지 않았어요')).not.toBeInTheDocument()

    // 나머지 1곳만 접힘 목록에 남는다.
    expect(screen.getByRole('button', { name: /다른 목적지 · 1곳/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^20-1/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /다른 목적지/ }))
    const others = screen.getAllByRole('button', { name: /20-1/ })
    // 펼친 뒤에도 11-A(내 목적지 카드)는 접힘 목록에 다시 나타나지 않는다.
    expect(screen.queryAllByRole('button', { name: /^11-A/ })).toHaveLength(1)
    expect(others.length).toBeGreaterThan(0)
  })

  it('즐겨찾기 노선이 지금 목록에 없으면(불일치) 안내 카드로 돌아간다', () => {
    mocks.favKeys = ['bus:99-9:하교']
    render(<BusPanel />)

    expect(screen.getByText('아직 목적지를 정하지 않았어요')).toBeInTheDocument()
  })

  it('등교 방향으로 즐겨찾기해도(하교 아님) 하교 화면의 "내 목적지"에 영향 없다', () => {
    mocks.favKeys = ['bus:11-A:등교']
    render(<BusPanel />)

    expect(screen.getByText('아직 목적지를 정하지 않았어요')).toBeInTheDocument()
  })
})

describe('BusPanel — 등교는 기존 목록 그대로(하교 전용 재구성 미적용)', () => {
  it('"내 목적지"/"다른 목적지" 문구 없이 노선 카드가 접지 않아도 바로 보인다', () => {
    mocks.station = '시흥시청'
    mocks.direction = '등교'
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: TWO_LIVE_ROUTES.map((a) => ({ ...a, category: '등교' })),
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<BusPanel />)

    expect(screen.queryByText('아직 목적지를 정하지 않았어요')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /다른 목적지/ })).not.toBeInTheDocument()
    // 접지 않아도 두 노선 모두 바로 보인다(기존 곧 도착/운행 중 섹션 그대로).
    expect(screen.getByRole('button', { name: /20-1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /11-A/ })).toBeInTheDocument()
  })
})
