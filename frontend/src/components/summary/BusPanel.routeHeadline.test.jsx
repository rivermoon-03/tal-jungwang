/**
 * 결함 #1 — 노선 카드 제목이 종점 이름만이라("아이파크아파트행", "시흥시청행")
 * 배지의 작은 번호를 봐야 노선을 알아볼 수 있었다(사용자 지적). 최근 시간표
 * 화면(SchedulePage)이 제목을 "출발지 → 목적지" 요약으로 바꿨다 — 홈도 같은
 * 규칙으로 맞춘다.
 *
 * 20-1 하교는 목적지를 덮어쓴다. busStationConfig.ROUTE_PATH는 이 노선의 물리적
 * 종점(아이파크아파트)을 쓰지만, 통학 목적으로는 대부분 정왕역에서 내린다.
 * 백엔드 bus_commute_contexts(scripts/schema.sql)도 이 노선의 destination_label을
 * 이미 "정왕역"으로 관리한다.
 *
 * 결함 #2 — "곧 도착"만 뜨고 몇 분인지 안 알려준다. eta.js의
 * IMMINENT_THRESHOLD_SEC(90초)에서 뽑은 상한("2분 이내")을 다음 차 정보가
 * 없을 때만 보조 줄에 보여준다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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

function arrivalsWith(extra) {
  mockUseBusArrivals.mockReturnValue({
    data: {
      arrivals: [
        {
          route_id: 1,
          route_no: '20-1',
          destination: '아이파크아파트행',
          category: '하교',
          arrival_type: 'realtime',
          arrive_in_seconds: 300,
          is_tomorrow: false,
          crowded: 0,
          ...extra,
        },
      ],
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
}

describe('BusPanel — 카드 제목 "출발지 → 목적지" (결함 #1)', () => {
  it('한국공학대 하교 20-1은 물리적 종점(아이파크아파트) 대신 통학 목적지(정왕역)를 쓴다', () => {
    arrivalsWith({})
    render(<BusPanel />)
    expect(screen.getByText('한국공대 → 정왕역')).toBeInTheDocument()
    expect(screen.queryByText(/아이파크/)).not.toBeInTheDocument()
  })
})

describe('BusPanel — "곧 도착"이 몇 분인지 알려준다 (결함 #2)', () => {
  it('임박(90초 이하)이고 다음 차 정보가 없으면 "N분 이내" 보조 문구를 보여준다', () => {
    arrivalsWith({ arrive_in_seconds: 60 })
    render(<BusPanel />)
    // "곧 도착"은 카드 ETA 큰 글자에도, "곧 도착" 섹션 제목(5분 이하 그룹)에도
    // 뜨므로 개수는 헤아리지 않고, 보조 줄의 남은 시간 상한만 정확히 본다.
    expect(screen.getAllByText('곧 도착').length).toBeGreaterThan(0)
    expect(screen.getByText('2분 이내')).toBeInTheDocument()
  })

  it('90초를 넘으면 ETA 큰 글자는 "N분"이고 "N분 이내" 보조 문구는 없다', () => {
    // 200초는 "곧 도착" 섹션(5분 이하)에는 들지만, eta.js 임계(90초)는 넘겨
    // ETA 큰 글자 자체는 "3분"이다 — 그때는 "N분 이내" 보조 문구를 붙이지 않는다.
    arrivalsWith({ arrive_in_seconds: 200 })
    render(<BusPanel />)
    expect(screen.getByText('3분')).toBeInTheDocument()
    expect(screen.queryByText('2분 이내')).not.toBeInTheDocument()
  })
})
