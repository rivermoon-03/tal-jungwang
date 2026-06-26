import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RouteDetailPage from './RouteDetailPage'
import * as useBusModule from '../hooks/useBus'

// 기본 mock 데이터 — is_realtime=true (실시간 노선)
const DEFAULT_MOCK_DATA = {
  route_no: '시흥33',
  direction_name: '시흥시청행',
  is_realtime: true,
  gbis_route_id: '224000062',
  stops: [
    { id: 'stop-1', name: '본캠' },
    { id: 'stop-2', name: '정왕역' },
    { id: 'stop-3', name: '시흥시청' },
  ],
  timetable: {
    weekday: [
      { depart_at: '07:10', is_last: false },
      { depart_at: '08:15', is_last: false },
      { depart_at: '22:50', is_last: true },
    ],
    saturday: [
      { depart_at: '09:00', is_last: false },
    ],
    sunday: [],
  },
  first_bus: '07:10',
  last_bus: '22:50',
  interval_label: '10~20분',
  total_trips: 38,
}

// is_realtime=false mock (시간표 전용 노선)
const TIMETABLE_ONLY_MOCK_DATA = {
  route_no: '3401',
  direction_name: '서울행',
  is_realtime: false,
  gbis_route_id: null,
  stops: [],
  timetable: {
    weekday: [
      { depart_at: '05:30', is_last: false },
      { depart_at: '07:00', is_last: false },
      { depart_at: '22:00', is_last: true },
    ],
    saturday: [],
    sunday: [],
  },
  first_bus: '05:30',
  last_bus: '22:00',
  total_trips: 30,
}

// 전체 routes mock (방향 탭 테스트용 — 3401은 등교/하교 두 방향)
const ALL_ROUTES_MOCK = [
  { route_number: '시흥33', category: '하교', is_realtime: true },
  { route_number: '시흥33', category: '등교', is_realtime: true },
  { route_number: '3401', category: '하교', is_realtime: false },
  { route_number: '3401', category: '등교', is_realtime: true },
]

vi.mock('../hooks/useBus', () => ({
  useBusTimetableByRoute: vi.fn(() => ({
    data: DEFAULT_MOCK_DATA,
    loading: false,
    error: null,
  })),
  useBusHistoryPreview: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
  })),
  useBusRoutes: vi.fn(() => ({
    data: ALL_ROUTES_MOCK,
    loading: false,
    error: null,
  })),
}))

// API 응답 어댑터: times 배열 형태 응답도 처리하는지 검증용 헬퍼
function makeTimesResponse(times, scheduleType = 'weekday', extra = {}) {
  return {
    route_id: 1,
    route_name: '3400',
    schedule_type: scheduleType,
    stop_id: null,
    stop_name: null,
    times,
    notes: times.map(() => null),
    is_realtime: false,
    gbis_route_id: null,
    ...extra,
  }
}

vi.mock('../hooks/useFavorites', () => ({
  default: vi.fn(() => ({ isFavorite: false, toggle: vi.fn() })),
}))

describe('RouteDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: DEFAULT_MOCK_DATA,
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusRoutes).mockReturnValue({
      data: ALL_ROUTES_MOCK,
      loading: false,
      error: null,
    })
  })

  it('노선 번호 뱃지가 렌더링됨 (route_no 또는 routeNumber)', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('시흥33')).toBeInTheDocument()
  })

  it('시간표 섹션이 렌더링됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('07:10')).toBeInTheDocument()
    expect(screen.getByText('08:15')).toBeInTheDocument()
  })

  it('막차 StatusChip이 렌더링됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('막차')).toBeInTheDocument()
  })

  it('뒤로가기 버튼 클릭 시 history.back() 호출', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    render(<RouteDetailPage routeNumber="33" />)
    const backBtn = screen.getByLabelText('뒤로')
    fireEvent.click(backBtn)
    expect(backSpy).toHaveBeenCalledOnce()
    backSpy.mockRestore()
  })

  it('평일/토/일 세그먼트 탭이 표시됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('평일')).toBeInTheDocument()
    expect(screen.getByText('토요일')).toBeInTheDocument()
    expect(screen.getByText('일요일')).toBeInTheDocument()
  })

  it('정류장 칩이 렌더링됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('본캠')).toBeInTheDocument()
    expect(screen.getByText('정왕역')).toBeInTheDocument()
  })

  it('is_realtime=true 노선: 이전 도착 기록 섹션이 표시됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    // stop_name이 없을 때 fallback 텍스트 포함 여부 확인 (복수 요소 가능)
    const recordEls = screen.getAllByText(/도착 기록/)
    expect(recordEls.length).toBeGreaterThan(0)
  })

  it('is_realtime=false 노선: 이전 도착 기록 섹션이 숨겨짐 (사용자 이슈 1)', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: TIMETABLE_ONLY_MOCK_DATA,
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3401" />)
    // 이전 도착 기록 헤더가 없어야 함 (도착 기록 텍스트 전체 없어야 함)
    expect(screen.queryByText(/도착 기록/)).not.toBeInTheDocument()
  })

  it('is_realtime=false 노선: InlineLiveRow가 렌더되지 않음 (사용자 이슈 1)', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: TIMETABLE_ONLY_MOCK_DATA,
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        arrivals: [
          { arrive_in_seconds: 180, depart_at: '09:00', stop_name: '정왕역' },
        ],
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3401" />)
    // "도착 예정" 텍스트(InlineLiveRow)가 없어야 함
    expect(screen.queryByText(/도착 예정/)).not.toBeInTheDocument()
  })

  it('is_realtime=true 노선: 실시간 도착 카드가 표시됨 (사용자 이슈 2)', () => {
    // histData 없을 때 "가져오는 중이에요" 안내
    render(<RouteDetailPage routeNumber="33" />)
    // 실시간 도착 카드의 로딩/안내 문구 확인
    expect(screen.getByText(/실시간 도착 정보를 가져오는 중이에요/)).toBeInTheDocument()
  })

  it('is_realtime=true 노선: realtime_eta가 있으면 도착 정보 표시됨 (사용자 이슈 2)', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        realtime_eta: {
          primary: { arrive_in_seconds: 300, arrive_at_hhmm: '09:05' },
          secondary: null,
        },
        columns: [],
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="33" />)
    // 실시간 도착 카드에 "5분" 또는 "09:05 도착 예정" 텍스트
    expect(screen.getByText(/실시간 도착/)).toBeInTheDocument()
    expect(screen.getByText('5분')).toBeInTheDocument()
    expect(screen.getByText('09:05 도착 예정')).toBeInTheDocument()
  })

  it('is_realtime=false 노선: 실시간 도착 카드가 숨겨짐', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: TIMETABLE_ONLY_MOCK_DATA,
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3401" />)
    // 실시간 도착 카드 관련 텍스트가 없어야 함
    expect(screen.queryByText(/실시간 도착/)).not.toBeInTheDocument()
    expect(screen.queryByText(/실시간 도착 정보를 가져오는 중이에요/)).not.toBeInTheDocument()
  })

  it('방향 탭: 노선에 등교/하교 두 방향이 있으면 탭이 표시됨', () => {
    render(<RouteDetailPage routeNumber="3401" />)
    // 3401은 ALL_ROUTES_MOCK에서 등교/하교 두 방향 → 탭 표시
    expect(screen.getByRole('tablist', { name: '방향 선택' })).toBeInTheDocument()
    expect(screen.getByText('등교')).toBeInTheDocument()
    expect(screen.getByText('하교')).toBeInTheDocument()
  })

  it('방향 탭: 하교 클릭 시 방향 탭 active가 변경됨', () => {
    render(<RouteDetailPage routeNumber="3401" />)
    const hajyoTab = screen.getByRole('tab', { name: '하교' })
    fireEvent.click(hajyoTab)
    expect(hajyoTab).toHaveAttribute('aria-selected', 'true')
  })

  it('방향 탭: 단일 방향 노선은 방향 탭이 표시되지 않음', () => {
    // 단일 방향 routes mock
    vi.mocked(useBusModule.useBusRoutes).mockReturnValue({
      data: [{ route_number: '시흥1', category: '하교', is_realtime: true }],
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="시흥1" />)
    expect(screen.queryByRole('tablist', { name: '방향 선택' })).not.toBeInTheDocument()
  })

  it('API가 times 배열로 응답할 때 시간표 행을 렌더한다 (응답 어댑터)', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: makeTimesResponse(['05:40', '06:00', '23:20'], 'weekday'),
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3400" />)
    expect(screen.getAllByText('05:40').length).toBeGreaterThan(0)
    expect(screen.getAllByText('06:00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('23:20').length).toBeGreaterThan(0)
  })

  it('direction_name이 헤더에 행선지로 표시됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('시흥시청행')).toBeInTheDocument()
  })

  it('times 배열 응답에 direction_name이 있으면 헤더에 표시됨 (응답 어댑터 보존)', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: makeTimesResponse(['08:00', '09:00', '22:00'], 'weekday', { direction_name: '서울행' }),
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3400" />)
    expect(screen.getByText('서울행')).toBeInTheDocument()
  })

  it('다음 차 행에 "다음 차" 강조 라벨이 렌더됨 (nextIdx 행)', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '3400',
        direction_name: '서울행',
        is_realtime: false,
        gbis_route_id: null,
        stops: [],
        timetable: {
          weekday: [
            { depart_at: '00:01', is_last: false },
            { depart_at: '23:58', is_last: false },
            { depart_at: '23:59', is_last: true },
          ],
          saturday: [],
          sunday: [],
        },
        first_bus: '00:01',
        last_bus: '23:59',
        total_trips: 3,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3400" />)
    const nextLabels = screen.queryAllByText('다음 차')
    if (new Date().getHours() < 23 || new Date().getMinutes() < 58) {
      expect(nextLabels.length).toBeGreaterThan(0)
    }
  })

  it('시간표 섹션 제목에 origin_stop_name과 "출발" 라벨이 표시됨', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: makeTimesResponse(['08:00', '09:00', '22:00'], 'weekday', {
        direction_name: '서울행',
        origin_stop_name: '한국공학대학교 시흥터미널',
      }),
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3400" />)
    const departures = screen.getAllByText(/한국공학대학교 시흥터미널 출발/)
    expect(departures.length).toBeGreaterThan(0)
  })

  it('origin_stop_name이 헤더 보조 표기에도 "출발" 라벨로 표시됨', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: makeTimesResponse(['08:00', '09:00', '22:00'], 'weekday', {
        direction_name: '서울행',
        origin_stop_name: '시흥터미널',
      }),
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3400" />)
    const departures = screen.getAllByText(/시흥터미널 출발/)
    expect(departures.length).toBeGreaterThan(0)
  })

  it('is_realtime=true 노선에서 liveEntry가 있을 때 InlineLiveRow에 "도착 예정" 라벨이 표시됨', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        arrivals: [
          {
            arrive_in_seconds: 180,
            depart_at: '09:00',
            stop_name: '정왕역',
          },
        ],
      },
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '시흥33',
        direction_name: '시흥시청행',
        origin_stop_name: '한국공학대학교',
        is_realtime: true,
        gbis_route_id: '224000062',
        stops: [],
        timetable: {
          weekday: [
            { depart_at: '00:01', is_last: false },
            { depart_at: '23:58', is_last: false },
            { depart_at: '23:59', is_last: true },
          ],
          saturday: [],
          sunday: [],
        },
        first_bus: '00:01',
        last_bus: '23:59',
        total_trips: 3,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="33" />)
    if (new Date().getHours() < 23 || new Date().getMinutes() < 58) {
      const arrivalLabels = screen.getAllByText(/도착 예정/)
      expect(arrivalLabels.length).toBeGreaterThan(0)
    }
  })

  it('혼합 노선(등교=실시간/하교=시간표): 기본 진입 시 실시간(등교) 방향과 그 origin이 표시됨', () => {
    // 5602 패턴: 등교(is_realtime=true), 하교(is_realtime=false) 두 route가 있는 노선.
    // category 미지정 첫 fetch에서 백엔드가 is_realtime=true 우선으로 등교 route를 반환함.
    // 프론트 defaultCategory도 is_realtime route를 우선 선택해야 함.
    const mixedRoutesData = [
      { route_number: '5602', category: '하교', is_realtime: false },
      { route_number: '5602', category: '등교', is_realtime: true },
    ]
    vi.mocked(useBusModule.useBusRoutes).mockReturnValue({
      data: mixedRoutesData,
      loading: false,
      error: null,
    })
    // 백엔드가 category 없이도 등교(is_realtime=true) route를 반환한 결과
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_id: 12,
        route_no: '5602번',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        category: '등교',
        stops: [],
        timetable: {
          weekday: [
            { depart_at: '06:30', is_last: false },
            { depart_at: '07:00', is_last: false },
            { depart_at: '22:00', is_last: true },
          ],
          saturday: [],
          sunday: [],
        },
        first_bus: '06:30',
        last_bus: '22:00',
        total_trips: 20,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" />)

    // 실시간(등교) 방향이 기본 선택됨: origin이 구로디지털단지역(등교 기점)이어야 함
    const originLabels = screen.getAllByText(/구로디지털단지역 출발/)
    expect(originLabels.length).toBeGreaterThan(0)

    // "이마트" 같은 하교 기점이 노출되지 않아야 함
    expect(screen.queryByText(/이마트 출발/)).not.toBeInTheDocument()

    // 방향 탭에서 등교가 기본 active(aria-selected=true)
    const deunggyo = screen.getByRole('tab', { name: '등교' })
    expect(deunggyo).toHaveAttribute('aria-selected', 'true')

    // 이전 도착 기록 섹션이 표시됨 (is_realtime=true)
    const recordEls = screen.getAllByText(/도착 기록/)
    expect(recordEls.length).toBeGreaterThan(0)
  })

  it('혼합 노선: 하교 탭 클릭 시 방향이 하교로 전환됨', () => {
    const mixedRoutesData = [
      { route_number: '5602', category: '하교', is_realtime: false },
      { route_number: '5602', category: '등교', is_realtime: true },
    ]
    vi.mocked(useBusModule.useBusRoutes).mockReturnValue({
      data: mixedRoutesData,
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_id: 12,
        route_no: '5602번',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        category: '등교',
        stops: [],
        timetable: {
          weekday: [{ depart_at: '06:30', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '06:30',
        last_bus: '06:30',
        total_trips: 1,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" />)

    // 초기에는 등교가 active
    expect(screen.getByRole('tab', { name: '등교' })).toHaveAttribute('aria-selected', 'true')

    // 하교 탭 클릭
    const hajyoTab = screen.getByRole('tab', { name: '하교' })
    fireEvent.click(hajyoTab)

    // 하교 탭이 active로 전환됨
    expect(hajyoTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '등교' })).toHaveAttribute('aria-selected', 'false')
  })

  // ── 그룹 분리 테스트 (내 정류장 도착 정보 vs 기점 출발 시간표) ──

  it('[그룹A] 실시간 노선에서 내 정류장 도착 정보 그룹 헤더에 stop_name이 포함됨', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        predicted_eta: { hhmm: '09:10', day_label: '평일', sample_size: 12 },
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '5602번',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:00', is_last: false }, { depart_at: '22:00', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:00',
        last_bus: '22:00',
        total_trips: 2,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" />)
    // 내 정류장 도착 정보 그룹 헤더에 "시흥시청역 도착 정보" 포함
    expect(screen.getByText('시흥시청역 도착 정보')).toBeInTheDocument()
  })

  it('[그룹B] 실시간 노선에서 기점 출발 시간표 그룹 헤더에 origin_stop_name이 포함됨', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '5602번',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:00', is_last: false }, { depart_at: '22:00', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:00',
        last_bus: '22:00',
        total_trips: 2,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" />)
    // 기점 출발 시간표 그룹 헤더에 "구로디지털단지역" 포함
    const departureSectionHeaders = screen.getAllByText(/구로디지털단지역.*출발/)
    expect(departureSectionHeaders.length).toBeGreaterThan(0)
  })

  it('[그룹분리] 실시간 노선에서 도착 정보 그룹과 출발 시간표 그룹이 모두 렌더됨', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        predicted_eta: { hhmm: '09:15', day_label: '평일', sample_size: 8 },
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '5602번',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:00', is_last: false }, { depart_at: '22:00', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:00',
        last_bus: '22:00',
        total_trips: 2,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" />)

    // 그룹A: 내 정류장 도착 정보 헤더 (정확한 텍스트)
    expect(screen.getByText('시흥시청역 도착 정보')).toBeInTheDocument()
    // 그룹B: 기점 출발 시간표
    const departureSectionHeaders = screen.getAllByText(/구로디지털단지역.*출발/)
    expect(departureSectionHeaders.length).toBeGreaterThan(0)
    // 시간표 시각도 표시
    expect(screen.getByText('07:00')).toBeInTheDocument()
  })

  it('다음 차 행에 bg-accent-bg 클래스가 적용됨', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '3400',
        direction_name: '서울행',
        is_realtime: false,
        gbis_route_id: null,
        stops: [],
        timetable: {
          weekday: [
            { depart_at: '00:01', is_last: false },
            { depart_at: '23:58', is_last: false },
            { depart_at: '23:59', is_last: true },
          ],
          saturday: [],
          sunday: [],
        },
        first_bus: '00:01',
        last_bus: '23:59',
        total_trips: 3,
      },
      loading: false,
      error: null,
    })
    const { container } = render(<RouteDetailPage routeNumber="3400" />)
    if (new Date().getHours() < 23 || new Date().getMinutes() < 58) {
      const highlighted = container.querySelector('.bg-accent-bg')
      expect(highlighted).toBeTruthy()
    }
  })

  // ── stop prop 분기 테스트 ──

  it('[stop=시흥시청] gbisStationId 있는 stop: 도착 정보 섹션만 표시, 출발 시간표 섹션 없음', () => {
    // 시흥시청은 gbisStationId='224000586' (GBIS 실시간 정류장)
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '5602',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:00', is_last: false }, { depart_at: '22:00', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:00',
        last_bus: '22:00',
        total_trips: 2,
      },
      loading: false,
      error: null,
    })
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        predicted_eta: { hhmm: '08:30', day_label: '평일', sample_size: 10 },
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" stop="시흥시청" />)

    // 도착 정보 섹션(그룹A)은 표시됨
    expect(screen.getByRole('region', { name: /내 정류장 도착 정보/ })).toBeInTheDocument()

    // 출발 시간표 섹션(그룹B)은 숨겨짐
    expect(screen.queryByRole('region', { name: /기점 출발 시간표/ })).not.toBeInTheDocument()
  })

  it('[stop=서울] gbisStationId null인 stop: 출발 시간표만 표시, 도착 정보 섹션 없음', () => {
    // 서울은 gbisStationId=null (시간표 전용)
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '5602',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: false,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:00', is_last: false }, { depart_at: '22:00', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:00',
        last_bus: '22:00',
        total_trips: 2,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" stop="서울" />)

    // 도착 정보 섹션(그룹A)은 숨겨짐
    expect(screen.queryByRole('region', { name: /내 정류장 도착 정보/ })).not.toBeInTheDocument()

    // 출발 시간표 섹션(그룹B)은 표시됨
    expect(screen.getByRole('region', { name: /기점 출발 시간표/ })).toBeInTheDocument()
    // 시간표 시각 표시
    expect(screen.getByText('07:00')).toBeInTheDocument()
  })

  it('[stop=시화터미널 + 시간표전용노선] GBIS 정류장이라도 is_realtime=false면 출발 시간표가 표시됨 (3400 빈 화면 회귀)', () => {
    // 시화터미널은 gbisStationId='224000861'(GBIS 정류장)이지만,
    // 3400은 gbis_route_id=NULL → is_realtime=false인 시간표 전용 노선.
    // 도착 정보 그룹은 실시간 데이터가 없어 비고, 시간표 그룹마저 숨기면
    // 화면이 통째로 빈다(사용자 신고). 시간표 전용 노선은 시간표를 보여줘야 한다.
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '3400',
        direction_name: '서울행',
        origin_stop_name: '한국공학대학교 시흥터미널',
        is_realtime: false,
        gbis_route_id: null,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '05:40', is_last: false }, { depart_at: '23:20', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '05:40',
        last_bus: '23:20',
        total_trips: 2,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="3400" stop="시화터미널" />)

    // 출발 시간표 섹션(그룹B)이 표시되어야 함 (빈 화면이면 안 됨)
    expect(screen.getByRole('region', { name: /기점 출발 시간표/ })).toBeInTheDocument()
    // 시간표 시각도 렌더
    expect(screen.getByText('05:40')).toBeInTheDocument()
    // 도착 정보 섹션(그룹A)은 숨겨짐 (is_realtime=false)
    expect(screen.queryByRole('region', { name: /내 정류장 도착 정보/ })).not.toBeInTheDocument()
  })

  it('[stop 없음] stop prop 미전달: 도착 정보와 출발 시간표가 모두 표시됨 (기존 동작 유지)', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '시흥33',
        direction_name: '시흥시청행',
        origin_stop_name: '한국공학대학교',
        is_realtime: true,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:10', is_last: false }, { depart_at: '22:50', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:10',
        last_bus: '22:50',
        total_trips: 3,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="시흥33" />)

    // stop 없으면 도착 정보 섹션도 표시
    expect(screen.getByRole('region', { name: /내 정류장 도착 정보/ })).toBeInTheDocument()
    // 출발 시간표도 표시
    expect(screen.getByRole('region', { name: /기점 출발 시간표/ })).toBeInTheDocument()
  })

  it('[헤더] stop 있으면 헤더에 정류장명이 표시됨', () => {
    vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
      data: {
        route_no: '5602',
        direction_name: '한국공학대학교행',
        origin_stop_name: '구로디지털단지역',
        is_realtime: true,
        stops: [],
        timetable: {
          weekday: [{ depart_at: '07:00', is_last: true }],
          saturday: [],
          sunday: [],
        },
        first_bus: '07:00',
        last_bus: '07:00',
        total_trips: 1,
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="5602" stop="시흥시청" />)
    // 헤더에 "시흥시청" 정류장 기준 표기
    expect(screen.getByText('시흥시청 기준')).toBeInTheDocument()
  })

  // ── 예측 폴백 제거 테스트 ──

  it('[실시간ETA] realtime_eta 있으면 실시간 도착 시각을 표시한다', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        realtime_eta: {
          primary: { arrive_in_seconds: 420, arrive_at_hhmm: '17:07' },
          secondary: null,
        },
        predicted_eta: { hhmm: '17:01', day_label: '평일', sample_size: 20 },
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="33" />)
    // 실시간 표시 배지 존재
    expect(screen.getByText(/실시간 도착/)).toBeInTheDocument()
    // 7분 ETA 표시
    expect(screen.getByText('7분')).toBeInTheDocument()
    // 도착 HH:MM 표시
    expect(screen.getByText('17:07 도착 예정')).toBeInTheDocument()
  })

  it('[예측폴백제거] realtime_eta 없고 predicted_eta만 있으면 예측 시각을 표시하지 않는다', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        realtime_eta: null,
        predicted_eta: { hhmm: '17:01', day_label: '평일', sample_size: 20 },
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="33" />)
    // 예측 시각(17:01)이 표시되지 않아야 함
    expect(screen.queryByText('17:01')).not.toBeInTheDocument()
    // "이력 기반 예측" 문구가 없어야 함
    expect(screen.queryByText(/이력 기반 예측/)).not.toBeInTheDocument()
  })

  it('[예측폴백제거] realtime_eta 없으면 빈 상태 안내 문구가 표시된다', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        realtime_eta: null,
        predicted_eta: { hhmm: '17:01', day_label: '평일', sample_size: 20 },
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    render(<RouteDetailPage routeNumber="33" />)
    // 실시간 정보 없음 안내가 표시되어야 함
    expect(screen.getByText(/실시간 도착 정보가 없어요/)).toBeInTheDocument()
  })

  it('[아이콘제거] RealtimeArrivalCard에 Radio 아이콘 SVG가 없다', () => {
    // realtime_eta 없는 케이스 (안내 카드)
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        realtime_eta: null,
        predicted_eta: null,
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    const { container } = render(<RouteDetailPage routeNumber="33" />)
    // Radio 아이콘은 lucide-react Radio SVG로 렌더됨.
    // RealtimeArrivalCard 내부에 Radio 아이콘 SVG가 없어야 한다.
    // RealtimeArrivalCard 영역: role="status" aria-live 또는 role="status" 엘리먼트
    const statusEls = container.querySelectorAll('[role="status"]')
    statusEls.forEach((el) => {
      // el 내부에 svg가 있으면 안 됨 (Radio 아이콘 컨테이너 span 제거 확인)
      expect(el.querySelector('svg')).toBeNull()
    })
  })

  it('[아이콘제거] realtime_eta 있을 때도 Radio 아이콘 SVG가 없다', () => {
    vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
      data: {
        stop_name: '시흥시청역',
        realtime_eta: {
          primary: { arrive_in_seconds: 300, arrive_at_hhmm: '09:05' },
          secondary: null,
        },
        predicted_eta: null,
        columns: [],
        arrivals: [],
      },
      loading: false,
      error: null,
    })
    const { container } = render(<RouteDetailPage routeNumber="33" />)
    const statusEls = container.querySelectorAll('[role="status"]')
    statusEls.forEach((el) => {
      expect(el.querySelector('svg')).toBeNull()
    })
  })
})
