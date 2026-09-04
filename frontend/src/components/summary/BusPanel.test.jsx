/**
 * BusPanel — 등교/하교 정류장 표기 + 빈 상태 카피 + 방향 필터 테스트
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOriginLabel } from '../dashboard/busStationConfig'
import BusPanel from './BusPanel'

// ── 스토어 모킹 ──
const mockSetDetailModal = vi.fn()

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedBusStation: '시흥시청',
      selectedBusDirection: '등교',
      selectedMode: 'bus',
      dashboardScrollTop: 0,
      setDashboardScrollTop: vi.fn(),
      setDetailModal: mockSetDetailModal,
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
  // 결함 #17/#27 — 실시간 미연결/완전 미운행 카드가 쓰는 시간표 폴백 훅.
  // 이 테스트 파일의 시나리오는 모두 실시간 값이 채워져 있어 실제로 호출되지
  // 않지만(오늘 미운행 섹션은 기본 접힘), 향후 시나리오 추가 시 크래시를 막기 위해
  // 항상 빈 시간표를 반환하도록 미리 모킹해 둔다.
  useBusTimetableByRoute: vi.fn(() => ({ data: { times: [] }, loading: false, error: null, refetch: vi.fn() })),
}))

// 기본 routesQuery (서울 탭용 — 시흥시청는 GBIS이므로 실제로 쓰이지 않음)
beforeEach(() => {
  mockSetDetailModal.mockClear()
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

// ────────────────────────────────────────────────────────────
// 5. BusPanel — TransitCard 리디자인: 섹션 + 풀네임 제목 검증
// ────────────────────────────────────────────────────────────
describe('BusPanel — TransitCard 섹션/제목 (결함 #3/#16/#27)', () => {
  it('ETA 5분 이하 노선은 "곧 도착" 섹션에 표시된다', () => {
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [
          {
            route_no: '5602',
            category: '등교',
            arrival_type: 'realtime',
            destination: '이마트(학교)',
            arrive_in_seconds: 200, // 3분20초 → 5분 이하
            is_tomorrow: false,
            crowded: 0,
          },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<BusPanel />)
    expect(screen.getByText('곧 도착')).toBeInTheDocument()
  })

  // 결함 #1 — 종점 이름만 뜨면 배지를 봐야 노선을 알아본다. 최근 시간표 화면과
  // 같은 규칙("출발지 → 목적지")으로 맞췄다. 시흥시청(등교) 5602는 이 정류장의
  // perRouteDisplay.origin이 '시흥시청역', ROUTE_PATH 목적지가 '학교행'(말미
  // "행"은 뗀다) → "시흥시청역 → 학교".
  it('카드 제목은 "출발지 → 목적지" 요약이고 말줄임 클래스를 쓰지 않는다', () => {
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [
          {
            route_no: '5602',
            category: '등교',
            arrival_type: 'realtime',
            destination: '이마트(학교)',
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
    render(<BusPanel />)
    const title = screen.getByText('시흥시청역 → 학교')
    expect(title.className).not.toMatch(/truncate/)
  })

  it('완전 미운행 노선이 있으면 "오늘 미운행 · N" 접힘 섹션이 기본 접힘 상태로 보인다', () => {
    // 5602만 실시간 응답에 있고, 시흥시청이 취급하는 시흥33/3401은 응답에 없음 →
    // 미운행 후보. 기준 목록은 서버 expected_routes 다(프런트 상수 아님).
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [
          {
            route_no: '5602',
            category: '등교',
            arrival_type: 'realtime',
            destination: '이마트(학교)',
            arrive_in_seconds: 600,
            is_tomorrow: false,
            crowded: 0,
          },
        ],
        expected_routes: [
          { route_id: 14, route_no: '시흥33', category: '등교', boarding_label: '시흥시청 승차' },
          { route_id: 10, route_no: '3401', category: '등교', boarding_label: '시흥시청 승차' },
          { route_id: 12, route_no: '5602', category: '등교', boarding_label: '시흥시청 승차' },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<BusPanel />)
    const toggle = screen.getByRole('button', { name: /오늘 미운행 · 2/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('홈 노선 카드는 별도 페이지 대신 공용 상세 모달을 연다', () => {
    mockUseBusArrivals.mockReturnValue({
      data: { arrivals: [{ route_no: '5602', route_id: 12, category: '등교', arrival_type: 'realtime', destination: '학교', arrive_in_seconds: 600, is_tomorrow: false, crowded: 0 }] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<BusPanel />)
    fireEvent.click(screen.getByText('시흥시청역 → 학교'))

    expect(mockSetDetailModal).toHaveBeenCalledWith(expect.objectContaining({
      type: 'bus',
      routeCode: '5602',
      category: '등교',
      commuteGroup: 'from-siheung-city-hall',
    }))
  })
})


// ────────────────────────────────────────────────────────────
// A1 잔여좌석 칩 · A3 "N정거장 전" 칩 (+ 공유 베타 칩)
// remain_seat: -1=정보 없음, 0=만차, N=잔여 N석 (백엔드 gbis 파싱 규약).
// 3401은 광역(express), 5602는 간선(trunk) — busStationConfig 기준.
// ────────────────────────────────────────────────────────────
describe('BusPanel — 잔여좌석·정거장 칩 (A1/A3)', () => {
  function arrivalsWith(extra, routeNo = '3401') {
    mockUseBusArrivals.mockReturnValue({
      data: {
        arrivals: [
          {
            route_id: 10,
            route_no: routeNo,
            destination: '석수행',
            category: '등교',
            arrival_type: 'realtime',
            depart_at: null,
            arrive_in_seconds: 600,
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

  // 칩 상한(TransitCard, 시안2) — 실시간 다음 자리의 잔여좌석 칩까지는 보이고,
  // 그 뒤(베타 등)는 화면에 "+N" 하나로 접힌다. 값 자체(베타가 붙는 로직)는
  // buildLiveRow가 여전히 계산하지만 표시는 상한 안에서만 보인다.
  it('광역 노선 remain_seat 11석 이상 → "잔여 N석" 칩이 보이고, 베타는 칩 상한에 접힌다', () => {
    arrivalsWith({ remain_seat: 23 })
    render(<BusPanel />)
    expect(screen.getByText('실시간')).toBeInTheDocument()
    expect(screen.getByText('잔여 23석')).toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
    expect(screen.getByText(/^\+\d+$/)).toBeInTheDocument()
  })

  it('광역 노선 remain_seat 0 → "만차" 칩', () => {
    arrivalsWith({ remain_seat: 0 })
    render(<BusPanel />)
    expect(screen.getByText('만차')).toBeInTheDocument()
  })

  it('remain_seat -1(정보 없음)이면 좌석 칩 대신 기존 혼잡도 칩을 유지한다', () => {
    arrivalsWith({ remain_seat: -1, crowded: 3 })
    render(<BusPanel />)
    expect(screen.queryByText(/잔여 \d+석/)).not.toBeInTheDocument()
    expect(screen.queryByText('만차')).not.toBeInTheDocument()
    expect(screen.getByText('혼잡')).toBeInTheDocument()
    // 좌석·정거장 칩이 없으면 베타 칩도 없다
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
  })

  it('비광역 노선(5602)은 remain_seat이 와도 좌석 칩을 그리지 않는다', () => {
    arrivalsWith({ remain_seat: 8, crowded: 2 }, '5602')
    render(<BusPanel />)
    expect(screen.queryByText(/잔여 \d+석/)).not.toBeInTheDocument()
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('location_no ≥ 1이면 "N정거장 전" 칩이 보인다(칩 상한 2개 안에 든다)', () => {
    arrivalsWith({ location_no: 4 }, '5602')
    render(<BusPanel />)
    expect(screen.getByText('실시간')).toBeInTheDocument()
    expect(screen.getByText('4정거장 전')).toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
    expect(screen.getByText(/^\+\d+$/)).toBeInTheDocument()
  })

  it('좌석 칩과 정거장 칩이 함께 있어도 칩 상한(2개)만 보이고 나머지는 접힌다', () => {
    arrivalsWith({ remain_seat: 15, location_no: 2 })
    render(<BusPanel />)
    // buildLiveRow는 실시간 다음에 좌석 칩을 먼저 넣으므로(정거장 칩보다 앞)
    // 상한 2개 안에는 [실시간, 잔여좌석]이 들고 정거장·베타는 접힌다.
    expect(screen.getByText('실시간')).toBeInTheDocument()
    expect(screen.getByText('잔여 15석')).toBeInTheDocument()
    expect(screen.queryByText('2정거장 전')).not.toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
    expect(screen.getByText(/^\+\d+$/)).toBeInTheDocument()
  })

  it('구형 캐시(remain_seat/location_no 키 없음)에서도 칩 없이 정상 렌더된다', () => {
    arrivalsWith({})
    render(<BusPanel />)
    expect(screen.getByText('3401')).toBeInTheDocument()
    expect(screen.queryByText(/잔여 \d+석/)).not.toBeInTheDocument()
    expect(screen.queryByText(/정거장 전/)).not.toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
  })
})

// ────────────────────────────────────────────────────────────
// 운행 시간대 밖 노선 — 달 + Zzz
// 자정 직후 프로덕션에서 막차가 끊긴 노선이 "실시간 연결 중 · 잠시 후 다시 확인"
// 으로 떠 있었다. 오지 않을 차를 기다리게 만드는 화면이라 상태를 먼저 말한다.
// ────────────────────────────────────────────────────────────
describe('BusPanel — 운행 시간대 밖', () => {
  function arrivalsWith(extra) {
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
            arrive_in_seconds: null,
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

  it('막차가 끊긴 노선은 "오늘 운행 종료"로 묶고 내일 첫차를 알려준다', () => {
    arrivalsWith({ off_service: true, next_first_at: '05:30', next_first_day: 'tomorrow' })
    render(<BusPanel />)

    expect(screen.getByText('오늘 운행 종료')).toBeInTheDocument()
    expect(screen.getByText('Zzz')).toBeInTheDocument()
    expect(screen.getByText('· 내일 첫차 05:30')).toBeInTheDocument()
    // 기다리라는 말이 남아 있으면 안 된다
    expect(screen.queryByText('실시간 연결 중')).not.toBeInTheDocument()
  })

  it('첫차 전이면 "종료"가 아니라 "지금은 운행 안 함"이다', () => {
    arrivalsWith({ off_service: true, next_first_at: '05:30', next_first_day: 'today' })
    render(<BusPanel />)

    expect(screen.getByText('지금은 운행 안 함')).toBeInTheDocument()
    expect(screen.getByText('· 오늘 첫차 05:30')).toBeInTheDocument()
  })

  it('판정 불가(off_service 없음)면 기존 실시간 연결 중 카드를 유지한다', () => {
    arrivalsWith({})
    render(<BusPanel />)

    expect(screen.queryByText('Zzz')).not.toBeInTheDocument()
    expect(screen.getByText('실시간 연결 중')).toBeInTheDocument()
  })
})
