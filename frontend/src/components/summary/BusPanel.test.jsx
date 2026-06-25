/**
 * BusPanel — 등교/하교 정류장 표기 + 빈 상태 카피 + 방향 필터 테스트
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOriginLabel } from '../dashboard/busStationConfig'
import BusPanel from './BusPanel'

// ── 스토어 모킹 ──
vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedBusStation: '시흥시청',
      selectedBusDirection: '등교',
      selectedMode: 'bus',
      dashboardScrollTop: 0,
      setDashboardScrollTop: vi.fn(),
    })
  ),
}))

// ── 방향 훅 모킹 ──
vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: vi.fn(() => ({ direction: '등교' })),
}))

// ── useBus 모킹 — useBusArrivals 반환값을 각 describe에서 교체 ──
const mockUseBusArrivals = vi.fn()
const mockUseBusRoutesByCategory = vi.fn()

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: (...args) => mockUseBusArrivals(...args),
  useBusRoutesByCategory: (...args) => mockUseBusRoutesByCategory(...args),
  useBusTimetable: vi.fn(() => ({ data: null, loading: false, error: null, refetch: vi.fn() })),
}))

// 기본 routesQuery (서울 탭용 — 시흥시청는 GBIS이므로 실제로 쓰이지 않음)
beforeEach(() => {
  mockUseBusRoutesByCategory.mockReturnValue({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
})

// ────────────────────────────────────────────────────────────
// 1. getOriginLabel 헬퍼 단위 테스트 (순수 함수, 렌더링 불필요)
// ────────────────────────────────────────────────────────────
describe('getOriginLabel — 등교/하교 표기 분기', () => {
  it('등교 정류장에서는 "○○ 탑승" 형태를 반환한다', () => {
    const label = getOriginLabel('시흥시청', '등교', '시흥시청역')
    expect(label).not.toMatch(/출발/)
    expect(label).toContain('시흥시청역')
    expect(label).toMatch(/탑승/)
  })

  it('하교 정류장에서는 "○○ 출발" 형태를 반환한다', () => {
    const label = getOriginLabel('이마트', '하교', '이마트')
    expect(label).toMatch(/출발/)
    expect(label).toContain('이마트')
  })

  it('등교 시 "출발"이라는 단어가 포함되면 안 된다', () => {
    const label = getOriginLabel('서울', '등교', '구로디지털')
    expect(label).not.toMatch(/출발/)
  })

  it('originName이 없으면 빈 문자열을 반환한다', () => {
    expect(getOriginLabel('시흥시청', '등교', '')).toBe('')
    expect(getOriginLabel('시흥시청', '등교', null)).toBe('')
    expect(getOriginLabel('시흥시청', '등교', undefined)).toBe('')
  })
})

// ────────────────────────────────────────────────────────────
// 2. BusPanel — 등교 방향 "출발" 미포함 검증
// ────────────────────────────────────────────────────────────
describe('BusPanel — 등교 정류장 "출발" 미포함', () => {
  beforeEach(() => {
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [
          {
            route_id: 12,
            route_no: '5602',
            destination: '이마트(학교)',
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
  })

  it('등교 방향 5602 카드에 "출발" 문자가 없어야 한다', () => {
    const { container } = render(<BusPanel />)
    expect(container.textContent).not.toMatch(/출발/)
  })

  it('등교 방향 5602 카드에 탑승 표현("탑승")이 있어야 한다', () => {
    const { container } = render(<BusPanel />)
    expect(container.textContent).toMatch(/탑승/)
  })
})

// ────────────────────────────────────────────────────────────
// 3. BusPanel — 빈 상태 카피 검증
// ────────────────────────────────────────────────────────────
describe('BusPanel — 빈 상태 카피', () => {
  beforeEach(() => {
    mockUseBusArrivals.mockReturnValue({
      data: { arrivals: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('"운행 정보 없음" 표현을 쓰지 않는다', () => {
    const { container } = render(<BusPanel />)
    expect(container.textContent).not.toMatch(/운행 정보 없음/)
  })

  it('arrivals가 빈 배열일 때 "실시간 정보" 관련 안내 메시지를 표시한다', () => {
    const { container } = render(<BusPanel />)
    expect(container.textContent).toMatch(/실시간/)
  })
})

// ────────────────────────────────────────────────────────────
// 4. BusPanel — 방향 필터 검증 (GBIS arrivals category 필터)
// ────────────────────────────────────────────────────────────
describe('BusPanel — GBIS arrivals 방향 필터', () => {
  beforeEach(() => {
    // 등교(5602)+하교(시흥1)가 섞인 응답 — 시흥시청은 등교 전용이므로 시흥1은 걸러져야 함
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [
          {
            route_no: '5602',
            category: '등교',
            arrival_type: 'realtime',
            arrive_in_seconds: 300,
            is_tomorrow: false,
            crowded: 0,
          },
          {
            route_no: '시흥1',
            category: '하교',
            arrival_type: 'realtime',
            arrive_in_seconds: 200,
            is_tomorrow: false,
            crowded: 0,
          },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('허용 방향(등교)에 맞지 않는 노선(시흥1 하교)은 표시하지 않는다', () => {
    const { container } = render(<BusPanel />)
    expect(container.textContent).not.toMatch(/시흥1/)
  })

  it('허용 방향(등교)의 노선(5602)은 표시한다', () => {
    const { container } = render(<BusPanel />)
    expect(container.textContent).toMatch(/5602/)
  })
})
