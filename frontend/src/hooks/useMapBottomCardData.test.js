/**
 * useMapBottomCardData 회귀 테스트.
 *
 * 배경: PC 지도 하단 카드가 정류장 헤더에 "실시간" 배지를 하나만 달고, 그 값을
 * 가장 빨리 오는 노선(first) 하나의 isRealtime으로 정했다. 그런데 노선 미니카드
 * (routes)에는 노선별 실시간 여부가 전혀 실리지 않아, 실제로는 99-2만 실시간이고
 * 3400은 시간표 기반인데도 화면 전체가 실시간처럼 읽혔다. routes[].source가
 * 노선별 실제 출처('live' | 'timetable' | null)를 들고 가야 이 오독을 막는다.
 */
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockState = {
  selectedBusStation: '시화터미널',
}

vi.mock('../stores/useAppStore', () => ({
  default: (selector) => selector(mockState),
}))

vi.mock('./useEffectiveDirection', () => ({
  default: () => ({ direction: '하교', isOverride: false }),
}))

const mockUseBusArrivals = vi.fn()
vi.mock('./useBus', () => ({
  useBusArrivals: (...args) => mockUseBusArrivals(...args),
}))

import useMapBottomCardData from './useMapBottomCardData'

// 시화터미널 실측 시나리오(2026-09-01 하교) — 99-2는 실시간으로 곧 도착, 3400은
// 시간표상 9분 뒤 출발, 5200은 오늘 시간표에 남은 출발이 없어 정보가 없다.
const ARRIVALS = [
  {
    route_id: 1,
    route_no: '99-2',
    destination: '이마트 경유 월곶역행',
    category: '하교',
    arrival_type: 'realtime',
    depart_at: null,
    arrive_in_seconds: 40,
    is_tomorrow: false,
    off_service: false,
    next_first_at: null,
    next_first_day: null,
    crowded: 0,
    remain_seat: -1,
    location_no: 0,
    crowded_estimated: false,
    boarding_label: null,
  },
  {
    route_id: 2,
    route_no: '3400',
    destination: '사당 경유 강남행',
    category: '하교',
    arrival_type: 'timetable',
    depart_at: '08:29',
    arrive_in_seconds: null,
    is_tomorrow: false,
    off_service: false,
    next_first_at: null,
    next_first_day: null,
    crowded: 0,
    remain_seat: -1,
    location_no: 0,
    crowded_estimated: false,
    boarding_label: null,
  },
  {
    route_id: 3,
    route_no: '5200',
    destination: '신천역 경유 신도림행',
    category: '하교',
    arrival_type: 'timetable',
    depart_at: null,
    arrive_in_seconds: null,
    is_tomorrow: false,
    off_service: false,
    next_first_at: null,
    next_first_day: null,
    crowded: 0,
    remain_seat: -1,
    location_no: 0,
    crowded_estimated: false,
    boarding_label: null,
  },
]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-01T08:20:00+09:00'))
  mockUseBusArrivals.mockReturnValue({
    data: { arrivals: ARRIVALS, expected_routes: [] },
    loading: false,
    error: null,
    fetchedAt: Date.now(),
    refetch: vi.fn(),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useMapBottomCardData — 노선별 실시간/시간표 출처', () => {
  it('실시간 노선과 시간표 노선이 섞여 있을 때 시간표 노선에 실시간 표시가 붙지 않는다', () => {
    const { result } = renderHook(() => useMapBottomCardData())

    const route3400 = result.current.routes.find((r) => r.id === '3400')
    expect(route3400.source).toBe('timetable')
    expect(route3400.source).not.toBe('live')
  })

  it('실시간 노선(99-2)에만 source=live가 붙는다', () => {
    const { result } = renderHook(() => useMapBottomCardData())

    const route992 = result.current.routes.find((r) => r.id === '99-2')
    expect(route992.source).toBe('live')
    expect(route992.etaText).toBe('곧 도착')
  })

  it('시간표 노선은 계산된 분 단위 ETA와 함께 source=timetable을 받는다', () => {
    const { result } = renderHook(() => useMapBottomCardData())

    const route3400 = result.current.routes.find((r) => r.id === '3400')
    expect(route3400.etaText).toBe('9분')
    expect(route3400.tone).toBe('ease')
  })

  it('오늘 남은 시간표가 없는 노선(5200)은 source가 null이고 muted 톤이다', () => {
    const { result } = renderHook(() => useMapBottomCardData())

    const route5200 = result.current.routes.find((r) => r.id === '5200')
    expect(route5200.etaText).toBe('운행 정보 없음')
    expect(route5200.source).toBeNull()
    expect(route5200.tone).toBe('muted')
  })

  it('카드 대표(live) 값은 가장 먼저 오는 노선(99-2)의 실시간 여부만 반영한다', () => {
    const { result } = renderHook(() => useMapBottomCardData())

    expect(result.current.live).toBe(true)
  })
})
