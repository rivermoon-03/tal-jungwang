/**
 * B6 — 심야 택시 승격 카드 테스트.
 *
 * 규칙: 응답의 전 노선이 "오늘 운행 종료"(off_service + 내일 첫차)일 때만 목록
 * 최상단에 카드 1장. 첫차가 60분 안이면 접는다(첫차 정보가 주인공). 요금·시간은
 * 택시 탭과 같은 훅(useTaxiDestinations)의 학교 정문→정왕역 프리셋을 재사용한다.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import BusPanel from './BusPanel'

const mockSetSelectedMode = vi.fn()

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedBusStation: '한국공학대',
      selectedBusDirection: '하교',
      selectedMode: 'bus',
      setDetailModal: vi.fn(),
      setSelectedMode: mockSetSelectedMode,
    })
  ),
}))

vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: vi.fn(() => ({ direction: '하교' })),
}))

const mockUseBusArrivals = vi.fn()

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: (...args) => mockUseBusArrivals(...args),
  useBusRoutesByCategory: vi.fn(() => ({ data: [], loading: false, error: null, refetch: vi.fn() })),
  useBusTimetable: vi.fn(() => ({ data: null, loading: false, error: null, refetch: vi.fn() })),
  useBusTimetableByRoute: vi.fn(() => ({ data: { times: [] }, loading: false, error: null, refetch: vi.fn() })),
}))

vi.mock('../../hooks/useTrafficIncidents', () => ({
  useTrafficIncidents: vi.fn(() => ({ incidents: [] })),
}))

const mockUseTaxiDestinations = vi.fn()
vi.mock('../../hooks/useTaxi', () => ({
  useTaxiDestinations: (...args) => mockUseTaxiDestinations(...args),
}))

/** 운행 종료 항목. 기본은 내일 첫차 07:30 — 어느 시각에 돌려도 60분 밖이다. */
function sleepingArrival(routeNo, extra = {}) {
  return {
    route_id: 1,
    route_no: routeNo,
    destination: '정왕역행',
    category: '하교',
    arrival_type: 'realtime',
    depart_at: null,
    arrive_in_seconds: null,
    is_tomorrow: false,
    crowded: 0,
    off_service: true,
    next_first_at: '07:30',
    next_first_day: 'tomorrow',
    ...extra,
  }
}

function arrivalsOf(list) {
  mockUseBusArrivals.mockReturnValue({
    data: { arrivals: list },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
}

const JEONGWANG_OK = {
  destinations: [
    { id: 'jeongwang_station', name: '정왕역', duration_seconds: 720, taxi_fee: 8800 },
    { id: 'sadang_station', name: '사당역', duration_seconds: 3600, taxi_fee: 45000 },
  ],
  loading: false,
  error: null,
  refetch: vi.fn(),
}

/**
 * 하교 화면 단순화(시안) 이후: 즐겨찾기하지 않은 노선은 전부 "다른 목적지" 접힘
 * 목록 안에 있다(기본 접힘). 이 파일의 시나리오는 즐겨찾기가 없으므로("내 목적지"
 * 안내 카드만 뜬다) 렌더 직후 그 접힘을 펼쳐야 "오늘 운행 종료" 등 섹션 검증이
 * 그대로 된다. TaxiPromoCard(택시 승격 카드)는 접힘 밖(항상 노출)이라 영향 없다.
 */
function renderExpanded() {
  const result = render(<BusPanel />)
  const toggle = screen.queryByRole('button', { name: /다른 목적지/ })
  if (toggle) fireEvent.click(toggle)
  return result
}

beforeEach(() => {
  mockSetSelectedMode.mockClear()
  mockUseTaxiDestinations.mockReturnValue(JEONGWANG_OK)
  arrivalsOf([sleepingArrival('11-A'), sleepingArrival('20-1', { route_id: 2 })])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BusPanel — 심야 택시 승격 카드 (B6)', () => {
  it('전 노선 운행 종료면 목록 최상단에 카드가 보인다', () => {
    const { container } = renderExpanded()

    expect(screen.getByText('지금은 택시가 빨라요')).toBeInTheDocument()
    // 목록 최상단 — "오늘 운행 종료" 섹션보다 앞에 있어야 한다
    const text = container.textContent
    expect(text.indexOf('지금은 택시가 빨라요')).toBeLessThan(text.indexOf('오늘 운행 종료'))
  })

  it('학교 정문→정왕역 소요·요금과 2인 분담액을 보여준다', () => {
    renderExpanded()

    expect(screen.getByText('학교 정문 → 정왕역 · 약 12분 · 약 8,800원')).toBeInTheDocument()
    expect(screen.getByText('2명이 나누면 4,400원')).toBeInTheDocument()
    expect(screen.getByText('실제 요금·시간과 다를 수 있습니다')).toBeInTheDocument()
  })

  it('카카오T 버튼은 새 탭 링크, 택시 탭 버튼은 모드 전환이다', () => {
    renderExpanded()

    const kakao = screen.getByRole('link', { name: '카카오T 열기' })
    expect(kakao).toHaveAttribute('href', 'https://t.kakao.com/launch')
    expect(kakao).toHaveAttribute('target', '_blank')

    fireEvent.click(screen.getByRole('button', { name: '택시 탭 보기' }))
    expect(mockSetSelectedMode).toHaveBeenCalledWith('taxi')
  })

  it('요금 조회 실패 시 숫자 줄은 생략하고 버튼만 남긴다', () => {
    mockUseTaxiDestinations.mockReturnValue({ destinations: null, loading: false, error: new Error('x'), refetch: vi.fn() })
    renderExpanded()

    expect(screen.getByText('지금은 택시가 빨라요')).toBeInTheDocument()
    expect(screen.queryByText(/약 \d+분/)).not.toBeInTheDocument()
    expect(screen.queryByText(/나누면/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '카카오T 열기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '택시 탭 보기' })).toBeInTheDocument()
  })

  it('운행 중 노선이 하나라도 있으면 카드를 만들지 않는다', () => {
    arrivalsOf([
      sleepingArrival('11-A'),
      { ...sleepingArrival('20-1', { route_id: 2 }), off_service: false, arrive_in_seconds: 600 },
    ])
    renderExpanded()

    expect(screen.queryByText('지금은 택시가 빨라요')).not.toBeInTheDocument()
  })

  it('첫차 전("지금은 운행 안 함")에는 카드를 만들지 않는다', () => {
    arrivalsOf([sleepingArrival('11-A', { next_first_day: 'today', next_first_at: '05:30' })])
    renderExpanded()

    expect(screen.getByText('지금은 운행 안 함')).toBeInTheDocument()
    expect(screen.queryByText('지금은 택시가 빨라요')).not.toBeInTheDocument()
  })

  it('내일 첫차가 60분 안이면(자정 직전) 카드를 접는다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T23:50:00'))
    arrivalsOf([sleepingArrival('11-A', { next_first_at: '00:20' })])
    renderExpanded()

    expect(screen.getByText('오늘 운행 종료')).toBeInTheDocument()
    expect(screen.queryByText('지금은 택시가 빨라요')).not.toBeInTheDocument()
  })

  it('내일 첫차가 60분 밖이면 자정 직전에도 카드가 보인다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T23:50:00'))
    arrivalsOf([sleepingArrival('11-A', { next_first_at: '05:30' })])
    renderExpanded()

    expect(screen.getByText('지금은 택시가 빨라요')).toBeInTheDocument()
  })
})
