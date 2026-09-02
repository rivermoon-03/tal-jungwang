/**
 * BusPanel — 실시간 미연결 폴백 카드 / 오늘 미운행 카드 회귀 테스트.
 *
 * 배경: 3400 시흥터미널 승차, 6502 이마트 승차는 해당 승차점에 시간표만 있다.
 * 백엔드가 이제 이런 조합을 `arrival_type="timetable"`로 내보내지만, 실시간
 * 관측점인데 아직 차량이 안 잡힌 노선(5200·99-2 등)은 여전히 폴백 카드로 온다.
 * 그 카드가
 *   1) 시간표 조회에 GBIS station id를 그대로 넘겨 항상 0행을 받고
 *   2) onClick 이 없어 상세 진입 자체가 막혀 있었다.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BusPanel from './BusPanel'

const mockSetDetailModal = vi.fn()

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedBusStation: '이마트',
      selectedBusDirection: '하교',
      selectedMode: 'bus',
      setDetailModal: mockSetDetailModal,
    })
  ),
}))

vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: vi.fn(() => ({ direction: '하교' })),
}))

const mockUseBusArrivals = vi.fn()
const mockUseBusTimetableByRoute = vi.fn()

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: (...args) => mockUseBusArrivals(...args),
  useBusRoutesByCategory: vi.fn(() => ({ data: [], loading: false, error: null, refetch: vi.fn() })),
  useBusTimetable: vi.fn(() => ({ data: null, loading: false, error: null, refetch: vi.fn() })),
  useBusTimetableByRoute: (...args) => mockUseBusTimetableByRoute(...args),
}))

/** 실시간 대상이지만 아직 ETA가 없는 항목 — 폴백 카드로 렌더된다. */
const PENDING_5200 = {
  route_id: 11,
  route_no: '5200',
  destination: '신도림행',
  category: '하교',
  arrival_type: 'realtime',
  depart_at: null,
  arrive_in_seconds: null,
  is_tomorrow: false,
}

/**
 * 하교 화면 단순화(시안) 이후: 즐겨찾기하지 않은 노선은 전부 "다른 목적지" 접힘
 * 목록 안에 있다(기본 접힘). 이 파일의 시나리오는 즐겨찾기가 없으므로("내 목적지"
 * 안내 카드만 뜬다) 렌더 직후 그 접힘을 펼쳐야 기존 카드/섹션 검증이 그대로 된다.
 */
function renderExpanded() {
  const result = render(<BusPanel />)
  const toggle = screen.queryByRole('button', { name: /다른 목적지/ })
  if (toggle) fireEvent.click(toggle)
  return result
}

beforeEach(() => {
  mockSetDetailModal.mockClear()
  mockUseBusTimetableByRoute.mockReset()
  mockUseBusTimetableByRoute.mockReturnValue({
    data: { times: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseBusArrivals.mockReturnValue({
    data: { arrivals: [PENDING_5200] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('실시간 미연결 폴백 카드', () => {
  it('승차점 시간표를 클라이언트가 따로 조회하지 않는다', () => {
    // 제품이 보장한 승차 시간표인지의 판단은 bus_information_sources 에 있고
    // 서버가 arrivals 의 depart_at 으로 이미 결정해 내려준다. 클라이언트가 노선번호로
    // 다시 조회하면 시흥1·시흥33처럼 source 로 연결하지 않은 원본 시간표가 새어나온다.
    renderExpanded()

    const calls = mockUseBusTimetableByRoute.mock.calls.filter((c) => c[0] === '5200')
    expect(calls).toHaveLength(0)
  })

  it('시간표가 없어도 카드를 눌러 상세를 열 수 있다', () => {
    renderExpanded()

    const card = screen.getByRole('button', { name: /5200/ })
    fireEvent.click(card)

    expect(mockSetDetailModal).toHaveBeenCalledTimes(1)
    expect(mockSetDetailModal.mock.calls[0][0]).toMatchObject({
      type: 'bus',
      routeCode: '5200',
      routeId: 11,
      category: '하교',
    })
  })

  it('시간표가 없으면 "출발"이 아니라 도착 정보 부재로 안내한다', () => {
    renderExpanded()

    expect(screen.getByText('현재 도착 정보 없음')).toBeInTheDocument()
    expect(screen.queryByText('출발 정보 없음')).not.toBeInTheDocument()
  })

  it('서버가 보장 시간표의 다음 출발을 주면 그 시각을 보여주고 여전히 클릭할 수 있다', () => {
    mockUseBusArrivals.mockReturnValue({
      data: { arrivals: [{ ...PENDING_5200, depart_at: '23:58' }] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderExpanded()

    expect(screen.getByText('23:58 출발')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /5200/ }))
    expect(mockSetDetailModal).toHaveBeenCalledTimes(1)
  })

  it('클라이언트 시간표 응답이 있어도 서버가 depart_at 을 안 주면 쓰지 않는다', () => {
    mockUseBusTimetableByRoute.mockReturnValue({
      data: { times: ['23:58'] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderExpanded()

    expect(screen.queryByText('23:58 출발')).not.toBeInTheDocument()
    expect(screen.getByText('현재 도착 정보 없음')).toBeInTheDocument()
  })
})

describe('정류장이 취급하는 노선 목록', () => {
  const EXPECTED = [
    { route_id: 11, route_no: '5200', category: '하교', boarding_label: '이마트 승차' },
    { route_id: 6, route_no: '6502', category: '하교', boarding_label: '이마트 승차' },
  ]

  beforeEach(() => {
    mockUseBusArrivals.mockReturnValue({
      data: { arrivals: [PENDING_5200], expected_routes: EXPECTED },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('승차 문구는 서버가 준 통학 맥락 라벨을 쓴다', () => {
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [{ ...PENDING_5200, boarding_label: '이마트 승차' }],
        expected_routes: EXPECTED,
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderExpanded()

    expect(screen.getByText('이마트 승차')).toBeInTheDocument()
  })

  it('오늘 미운행 목록은 expected_routes 에서 온다', () => {
    renderExpanded()

    // 5200 은 arrivals 에 있으므로 6502 하나만 미운행
    expect(screen.getByRole('button', { name: /오늘 미운행 · 1/ })).toBeInTheDocument()
  })

  it('오늘 미운행 카드는 시간표를 따로 조회하지 않고 상세로 진입한다', () => {
    renderExpanded()

    fireEvent.click(screen.getByRole('button', { name: /오늘 미운행/ }))
    fireEvent.click(screen.getByRole('button', { name: /6502/ }))

    expect(mockUseBusTimetableByRoute).not.toHaveBeenCalled()
    expect(mockSetDetailModal).toHaveBeenCalledTimes(1)
    expect(mockSetDetailModal.mock.calls[0][0]).toMatchObject({
      type: 'bus',
      routeCode: '6502',
      routeId: 6,
      category: '하교',
    })
  })

  it('expected_routes 가 없으면 미운행 섹션을 만들지 않는다', () => {
    mockUseBusArrivals.mockReturnValue({
      data: { arrivals: [PENDING_5200] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderExpanded()

    expect(screen.queryByRole('button', { name: /오늘 미운행/ })).not.toBeInTheDocument()
  })
})
