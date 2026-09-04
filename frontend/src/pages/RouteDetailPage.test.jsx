import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RouteDetailPage from './RouteDetailPage'
import * as useBusModule from '../hooks/useBus'
import * as useCrowdingFlowModule from '../hooks/useCrowdingFlow'

// RouteCrowdingSummary(④)가 쓰는 훅 — 실제 fetch를 타지 않도록 목으로 고정.
// 기본값은 데이터 없음(둘 다 null)이라 섹션 자체가 렌더되지 않는다(요약화 규칙).
vi.mock('../hooks/useCrowdingFlow', () => ({
  useCrowdingFlow: vi.fn(() => ({ data: null, loading: false, error: null })),
}))

// 즐겨찾기 — favKey 스키마(utils/favKey.js) + 스토어 keys 배열/toggleFavoriteKey를 목으로 고정.
const mockToggleFavoriteKey = vi.fn()
let mockFavoriteKeys = []
vi.mock('../stores/useAppStore', () => ({
  default: vi.fn((selector) => selector({
    favorites: { keys: mockFavoriteKeys },
    toggleFavoriteKey: mockToggleFavoriteKey,
  })),
}))

// 기본 mock 데이터 — is_realtime=true (실시간 노선), 등교/하교 아직 미분화
const DEFAULT_MOCK_DATA = {
  route_id: 100,
  route_no: '시흥33',
  direction_name: '시흥시청행',
  is_realtime: true,
  gbis_route_id: '224000062',
  origin_stop_name: '한국공학대학교',
  stops: [
    { id: 'stop-1', name: '본캠' },
  ],
  timetable: {
    weekday: [
      { depart_at: '07:10', is_last: false },
      { depart_at: '08:15', is_last: false },
      { depart_at: '22:50', is_last: true },
    ],
    saturday: [
      { depart_at: '09:00', is_last: true },
    ],
    sunday: [],
  },
}

// is_realtime=false mock (시간표 전용 노선)
const TIMETABLE_ONLY_MOCK_DATA = {
  route_id: 200,
  route_no: '3401',
  direction_name: '서울행',
  is_realtime: false,
  gbis_route_id: null,
  origin_stop_name: '한국공학대학교',
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
}

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

describe('RouteDetailPage', () => {
  beforeEach(() => {
    // 요일 탭 판정이 실제 시각(new Date())에 의존하므로, 주말에 테스트가 깨지지
    // 않도록 평일(2026-01-06 화요일 정오 KST)로 Date만 고정한다.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-06T12:00:00+09:00'))
    vi.clearAllMocks()
    mockFavoriteKeys = []
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
    vi.mocked(useCrowdingFlowModule.useCrowdingFlow).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('노선 번호 뱃지가 렌더링됨', () => {
    render(<RouteDetailPage routeNumber="33" />)
    expect(screen.getByText('시흥33')).toBeInTheDocument()
  })

  it('뒤로가기 버튼 클릭 시 history.back() 호출', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    render(<RouteDetailPage routeNumber="33" />)
    fireEvent.click(screen.getByLabelText('뒤로'))
    expect(backSpy).toHaveBeenCalledOnce()
    backSpy.mockRestore()
  })

  it('direction_name이 헤더에 행선지로 표시됨', () => {
    const { container } = render(<RouteDetailPage routeNumber="33" />)
    // ③ 정류장 섹션에도 방면(direction_name)이 동일 문자열로 표시되므로(정직한 재사용),
    // 헤더 영역으로 스코프를 좁혀 확인한다.
    expect(container.querySelector('header').textContent).toMatch(/시흥시청행/)
  })

  it('스크롤 영역 하단에 모바일 FloatingDock을 피할 여백이 있다(pb-28)', () => {
    render(<RouteDetailPage routeNumber="33" />)
    const scrollContainer = document.querySelector('.overflow-y-auto')
    const contentWrapper = scrollContainer.firstElementChild
    expect(contentWrapper.className).toMatch(/\bpb-28\b/)
  })

  describe('방향 세그먼트(등교/하교)', () => {
    it('노선에 두 방향이 있으면 세그먼트가 표시됨', () => {
      render(<RouteDetailPage routeNumber="3401" />)
      expect(screen.getByRole('tablist', { name: '방향 선택' })).toBeInTheDocument()
      expect(screen.getByText('등교')).toBeInTheDocument()
      expect(screen.getByText('하교')).toBeInTheDocument()
    })

    it('하교 클릭 시 active가 변경됨', () => {
      render(<RouteDetailPage routeNumber="3401" />)
      const hajyoTab = screen.getByRole('tab', { name: '하교' })
      fireEvent.click(hajyoTab)
      expect(hajyoTab).toHaveAttribute('aria-selected', 'true')
    })

    it('단일 방향 노선은 세그먼트가 표시되지 않음', () => {
      vi.mocked(useBusModule.useBusRoutes).mockReturnValue({
        data: [{ route_number: '시흥1', category: '하교', is_realtime: true }],
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="시흥1" />)
      expect(screen.queryByRole('tablist', { name: '방향 선택' })).not.toBeInTheDocument()
    })
  })

  describe('① 도착 카드(ArrivalEtaCard)', () => {
    it('histData 로딩 중이면 안내 문구를 보여준다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText(/실시간 도착 정보를 가져오는 중이에요/)).toBeInTheDocument()
    })

    it('realtime_eta primary+secondary가 있으면 2슬롯이 모두 표시된다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: {
          realtime_eta: {
            primary: { arrive_in_seconds: 300, arrive_at_hhmm: '09:05' },
            secondary: { arrive_in_seconds: 900, arrive_at_hhmm: '09:20' },
          },
          columns: [],
        },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('5분')).toBeInTheDocument()
      expect(screen.getByText('09:05 도착')).toBeInTheDocument()
      expect(screen.getByText('15분')).toBeInTheDocument()
      expect(screen.getByText('09:20 도착')).toBeInTheDocument()
    })

    it('secondary가 없으면 시간표 기준 다음 출발로 둘째 슬롯을 보강한다', () => {
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
      // 정오(720분) 기준 다음 출발은 22:50
      render(<RouteDetailPage routeNumber="33" />)
      const arrivalSection = screen.getByRole('region', { name: '도착 정보' })
      expect(within(arrivalSection).getByText('22:50')).toBeInTheDocument()
      expect(screen.getByText('시간표 기준 출발')).toBeInTheDocument()
    })

    it('secondary도 시간표도 없으면 "이후 정보 없음"을 표시한다', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: { ...DEFAULT_MOCK_DATA, timetable: { weekday: [], saturday: [], sunday: [] } },
        loading: false,
        error: null,
      })
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: {
          realtime_eta: { primary: { arrive_in_seconds: 300, arrive_at_hhmm: '09:05' }, secondary: null },
          columns: [],
        },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('이후 정보 없음')).toBeInTheDocument()
    })

    it('realtime_eta 없고 시간표가 있으면 시간표 기준 다음 출발을 크게 보여준다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: { realtime_eta: null, columns: [] },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('다음 출발 (시간표 기준)')).toBeInTheDocument()
      const arrivalSection = screen.getByRole('region', { name: '도착 정보' })
      expect(within(arrivalSection).getByText('22:50')).toBeInTheDocument()
      // 모순 카피("실시간 도착 정보가 없어요" + "시간표가 없는 실시간 노선") 제거 확인
      expect(screen.queryByText(/실시간 도착 정보가 없어요/)).not.toBeInTheDocument()
    })

    it('실시간도 시간표도 없으면 수시 운행 안내 한 문장만 표시한다', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: { ...DEFAULT_MOCK_DATA, timetable: { weekday: [], saturday: [], sunday: [] } },
        loading: false,
        error: null,
      })
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: { realtime_eta: null, columns: [] },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('이 노선은 정해진 시간표 없이 수시 운행해요')).toBeInTheDocument()
      expect(screen.getByText(/실시간 신호가 잡히면 여기에 표시돼요/)).toBeInTheDocument()
      // 모순 카피 제거 확인
      expect(screen.queryByText(/정해진 출발 시간표가 없는 실시간 운행 노선/)).not.toBeInTheDocument()
    })

    it('is_realtime=false 노선: 도착 카드가 시간표 기준으로만 표시된다(실시간 문구 없음)', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: TIMETABLE_ONLY_MOCK_DATA,
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3401" />)
      // 예전 "실시간 도착"(주 라벨) 문구는 없어야 한다 — 상태3 문구가 "실시간 위치
      // 신호가 없다"고 설명하는 것 자체는 모순이 아니므로 그 단어 자체는 허용한다.
      expect(screen.queryByText(/실시간 도착/)).not.toBeInTheDocument()
      expect(screen.getByText('다음 출발 (시간표 기준)')).toBeInTheDocument()
    })

    it('em-dash(—) 폴백 텍스트가 렌더되지 않는다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: { realtime_eta: { primary: {}, secondary: null }, columns: [] },
        loading: false,
        error: null,
      })
      const { container } = render(<RouteDetailPage routeNumber="33" />)
      expect(container.textContent).not.toMatch(/—/)
    })
  })

  describe('② 시간표 섹션(TimetableSection)', () => {
    it('첫차/막차/배차 3타일이 렌더된다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      const section = screen.getByRole('region', { name: '시간표' })
      expect(within(section).getByText('첫차')).toBeInTheDocument()
      expect(within(section).getByText('07:10')).toBeInTheDocument()
      expect(within(section).getByText('막차')).toBeInTheDocument()
      expect(within(section).getByText('22:50')).toBeInTheDocument()
      expect(within(section).getByText('배차')).toBeInTheDocument()
    })

    it('요약 한 줄에 "평일 시간표 · 총 N회 · 남은 M회 · 기점 승차"가 표시된다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      // 시스템 시각은 2026-01-06 12:00 — 07:10/08:15는 지났고 22:50만 남는다.
      expect(screen.getByText('평일 시간표 · 총 3회 · 남은 1회 · 한국공학대학교 승차')).toBeInTheDocument()
    })

    it('요일 칩 → 요약 한 줄 → 3타일 순서로 나온다(다섯 블록 순서 고정)', () => {
      render(<RouteDetailPage routeNumber="33" />)
      const section = screen.getByRole('region', { name: '시간표' })
      const text = section.textContent
      const chipIdx = text.indexOf('토요일') // 요일 칩(평일/토요일)
      const summaryIdx = text.indexOf('시간표 · 총')
      const tileIdx = text.indexOf('첫차')
      expect(chipIdx).toBeGreaterThan(-1)
      expect(chipIdx).toBeLessThan(summaryIdx)
      expect(summaryIdx).toBeLessThan(tileIdx)
    })

    it('"전체 시간표 보기"를 누르면 개별 시각이 펼쳐진다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.queryByText('08:15')).not.toBeInTheDocument()
      fireEvent.click(screen.getByText('전체 시간표 보기'))
      expect(screen.getByText('08:15')).toBeInTheDocument()
    })

    it('데이터가 있는 요일만 칩으로 노출된다(일요일 시간표 없음 → 칩 없음)', () => {
      render(<RouteDetailPage routeNumber="33" />)
      // 평일/토요일만 있고 일요일은 빈 배열 → "일/공휴일" 칩 자체가 없어야 함
      expect(screen.queryByText('일/공휴일')).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: '토요일' })).toBeInTheDocument()
    })

    it('요일 칩 전환 시 해당 요일 시간표로 바뀐다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      fireEvent.click(screen.getByRole('tab', { name: '토요일' }))
      // 토요일 09:00 단일 운행 — 정오 기준 이미 지나 남은 0회.
      expect(screen.getByText('토요일 시간표 · 총 1회 · 남은 0회 · 한국공학대학교 승차')).toBeInTheDocument()
      fireEvent.click(screen.getByText('전체 시간표 보기'))
      // 토요일은 09:00 단일 운행 — 첫차/막차 타일 + 펼침 그리드 칩까지 여러 곳에 나타난다.
      const section = screen.getByRole('region', { name: '시간표' })
      expect(within(section).getAllByText('09:00').length).toBeGreaterThan(0)
    })

    it('시간표가 없는 노선(모든 요일 빈 배열)은 섹션 자체가 숨겨진다', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: { ...DEFAULT_MOCK_DATA, timetable: { weekday: [], saturday: [], sunday: [] } },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.queryByText('첫차')).not.toBeInTheDocument()
    })

    it('API가 times 배열로 응답할 때도 시간표를 렌더한다 (응답 어댑터)', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: makeTimesResponse(['05:40', '06:00', '23:20'], 'weekday'),
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3400" />)
      const section = screen.getByRole('region', { name: '시간표' })
      // 실시간 출처가 없는 방면은 전체 시간표가 처음부터 펼쳐진다. 그래서 첫차
      // 타일과 펼친 목록에 같은 시각이 함께 나온다. 이 테스트가 확인하려는 건
      // times 배열 응답을 시간표로 그려내는가이므로 개수는 따지지 않는다.
      expect(within(section).getAllByText('05:40').length).toBeGreaterThan(0)
      expect(within(section).getAllByText('23:20').length).toBeGreaterThan(0)
    })
  })

  describe('③ 정류장 섹션(StopsSection)', () => {
    it('등록된 탑승 정류장과 "여기서 탑승" 칩이 표시된다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('본캠')).toBeInTheDocument()
      expect(screen.getByText('여기서 탑승')).toBeInTheDocument()
    })

    it('방면(direction_name)이 종점으로 표시된다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      const section = screen.getByRole('region', { name: '정류장' })
      expect(section.textContent).toMatch(/시흥시청행/)
    })
  })

  describe('④ 혼잡도 섹션(RouteCrowdingSummary)', () => {
    it('is_realtime=false 노선에서는 섹션이 마운트되지 않는다', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: TIMETABLE_ONLY_MOCK_DATA,
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3401" />)
      expect(screen.queryByRole('region', { name: '노선 혼잡도' })).not.toBeInTheDocument()
    })

    it('표본이 전혀 없으면(모두 null) 섹션이 렌더되지 않는다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.queryByRole('region', { name: '노선 혼잡도' })).not.toBeInTheDocument()
    })

    it('등급 분산이 없으면(전부 여유) 문장만 보이고 히트맵 펼치기 버튼은 없다', () => {
      vi.mocked(useCrowdingFlowModule.useCrowdingFlow).mockReturnValue({
        data: {
          stop_name: '한국공학대학교',
          total_samples: 100,
          points: [
            { hour: 8, minute: 0, ratio: 0.0, samples: 50 },
            { hour: 9, minute: 0, ratio: 0.01, samples: 50 },
          ],
        },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByRole('region', { name: '노선 혼잡도' })).toBeInTheDocument()
      expect(screen.getByText(/시간대별 차이가 크지 않아요/)).toBeInTheDocument()
      expect(screen.queryByText('시간대별 자세히 보기')).not.toBeInTheDocument()
    })

    it('등급이 갈리면 문장 + 펼치기 버튼이 보이고, 펼치면 12칸 그리드가 나타난다', () => {
      vi.mocked(useCrowdingFlowModule.useCrowdingFlow).mockReturnValue({
        data: {
          stop_name: '한국공학대학교',
          total_samples: 100,
          points: [
            { hour: 8, minute: 0, ratio: 0.45, samples: 50 },
            { hour: 12, minute: 0, ratio: 0.0, samples: 50 },
          ],
        },
        loading: false,
        error: null,
      })
      const { container } = render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText(/8시가 가장 붐벼요/)).toBeInTheDocument()
      fireEvent.click(screen.getByText('시간대별 자세히 보기'))
      expect(container.querySelector('.grid-cols-12')).toBeTruthy()
    })

    it('"GBIS", "표본 N건" 문구가 화면에 노출되지 않는다(툴팁 title만 허용)', () => {
      vi.mocked(useCrowdingFlowModule.useCrowdingFlow).mockReturnValue({
        data: {
          stop_name: '한국공학대학교',
          total_samples: 100,
          points: [{ hour: 8, minute: 0, ratio: 0.45, samples: 50 }, { hour: 12, minute: 0, ratio: 0.0, samples: 50 }],
        },
        loading: false,
        error: null,
      })
      const { container } = render(<RouteDetailPage routeNumber="33" />)
      expect(screen.queryByText(/GBIS/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^표본 \d+건$/)).not.toBeInTheDocument()
      // title 속성에는 남아 있어도 됨(툴팁)
      expect(container.querySelector('[title*="표본"]')).toBeTruthy()
    })
  })

  describe('⑤ 도착 기록 섹션(ArrivalHistory)', () => {
    it('is_realtime=true 노선에서만 렌더된다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByRole('region', { name: '과거 도착 기록' })).toBeInTheDocument()
    })

    it('is_realtime=false 노선에서는 렌더되지 않는다', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: TIMETABLE_ONLY_MOCK_DATA,
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3401" />)
      expect(screen.queryByRole('region', { name: '과거 도착 기록' })).not.toBeInTheDocument()
    })

    it('헤더/기록/배차 간격 결론 문장이 표시된다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: {
          stop_name: '한국공학대학교',
          realtime_eta: null,
          columns: [
            { label: '어제', day_label: '1/5(월)', times: ['07:00', '07:30', '07:50'] },
            { label: '이틀 전', day_label: '1/4(일)', times: ['07:10', '07:40'] },
            { label: '7일 전', day_label: '12/30(화)', times: ['07:05'] },
          ],
        },
        loading: false,
        error: null,
      })
      // 07:20 근처를 "지금"으로 고정해 07시대 기록이 창(window) 안에 들어오게 한다
      vi.setSystemTime(new Date('2026-01-06T07:20:00+09:00'))
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('이 시간대 실제 도착')).toBeInTheDocument()
      expect(screen.getByText(/평일 이 시간대엔 보통/)).toBeInTheDocument()
    })

    it('과거 도착 기록 없음 안내는 EmptyState로 표시된다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: { stop_name: '한국공학대학교', realtime_eta: null, columns: [] },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText(/아직 비교할 기록이 없어요/)).toBeInTheDocument()
    })
  })

  describe('② 하단 "과거 도착 기록 보기" 링크(결함 #30 — 중복 제거, 단일 진입점)', () => {
    it('실시간 노선에서는 시간표 섹션 하단에 링크가 정확히 1개만 존재한다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      const links = screen.getAllByText('과거 도착 기록 보기')
      expect(links.length).toBe(1)
    })

    it('is_realtime=false 노선에서는 링크가 렌더되지 않는다(기록 섹션 자체가 없음)', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: TIMETABLE_ONLY_MOCK_DATA,
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3401" />)
      expect(screen.queryByText('과거 도착 기록 보기')).not.toBeInTheDocument()
    })
  })

  describe('즐겨찾기(favKey)', () => {
    // routeNumber="33"은 ALL_ROUTES_MOCK의 route_number("시흥33")와 일치하지 않아
    // availableCategories가 비고 direction 세그먼트가 빈 문자열로 채워진다
    // (makeFavKey 관례 — direction 없으면 "" 유지, 참고: utils/favKey.js).
    it('별 클릭 시 makeFavKey({mode:bus,...}) 형태의 키로 toggleFavoriteKey가 호출된다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      fireEvent.click(screen.getByLabelText('즐겨찾기 추가'))
      expect(mockToggleFavoriteKey).toHaveBeenCalledWith('bus:100:')
    })

    it('방향이 있는 노선은 favKey에 direction이 포함된다', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: TIMETABLE_ONLY_MOCK_DATA,
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3401" />)
      fireEvent.click(screen.getByRole('tab', { name: '하교' }))
      fireEvent.click(screen.getByLabelText('즐겨찾기 추가'))
      expect(mockToggleFavoriteKey).toHaveBeenCalledWith('bus:200:하교')
    })

    it('favorites.keys에 해당 키가 있으면 별이 채워진 상태(즐겨찾기 해제 라벨)로 표시된다', () => {
      mockFavoriteKeys = ['bus:100:']
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByLabelText('즐겨찾기 해제')).toBeInTheDocument()
    })
  })

  // ── stop prop 분기 테스트 ──
  describe('stop prop 분기', () => {
    // 예전에는 GBIS 정류장이면 실시간만 남기고 시간표를 숨겼다. 도착 정보가 있으니
    // 중복이라는 판단이었는데 정보가 사라졌다(시화터미널의 3400 이 평일 43편을 갖고도
    // 첫차/막차/배차가 안 나왔다). 실시간과 시간표는 답하는 질문이 달라 둘 다 보여준다.
    it('[stop=시흥시청] gbisStationId 있는 stop: 도착 정보와 시간표를 함께 보여준다', () => {
      vi.mocked(useBusModule.useBusHistoryPreview).mockReturnValue({
        data: { stop_name: '시흥시청역', realtime_eta: null, columns: [] },
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="33" stop="시흥시청" />)
      expect(screen.getByRole('region', { name: '도착 정보' })).toBeInTheDocument()
      expect(screen.getByText('첫차')).toBeInTheDocument()
    })

    it('[stop=서울] gbisStationId null인 stop: 시간표만 표시, 도착 정보 숨김', () => {
      render(<RouteDetailPage routeNumber="33" stop="서울" />)
      expect(screen.queryByRole('region', { name: '도착 정보' })).not.toBeInTheDocument()
      expect(screen.getByText('첫차')).toBeInTheDocument()
    })

    it('[stop=시화터미널 + 시간표전용노선] GBIS 정류장이라도 is_realtime=false면 시간표가 표시됨', () => {
      vi.mocked(useBusModule.useBusTimetableByRoute).mockReturnValue({
        data: TIMETABLE_ONLY_MOCK_DATA,
        loading: false,
        error: null,
      })
      render(<RouteDetailPage routeNumber="3400" stop="시화터미널" />)
      expect(screen.getByText('첫차')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: '도착 정보' })).not.toBeInTheDocument()
    })

    it('[헤더] stop 있으면 헤더에 정류장명이 표시됨', () => {
      render(<RouteDetailPage routeNumber="33" stop="시흥시청" />)
      expect(screen.getByText('시흥시청 기준')).toBeInTheDocument()
    })
  })

  describe('막차 임박 배너', () => {
    it('막차 30분 이내면 상단에 배너가 렌더된다', () => {
      vi.setSystemTime(new Date('2026-01-06T22:40:00+09:00'))
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.getByText('시흥33 오늘 막차')).toBeInTheDocument()
      expect(screen.getByText('22:50 출발 · 10분 남음')).toBeInTheDocument()
    })

    it('막차까지 30분보다 여유 있으면(정오) 배너가 렌더되지 않는다', () => {
      render(<RouteDetailPage routeNumber="33" />)
      expect(screen.queryByText(/오늘 막차/)).not.toBeInTheDocument()
    })
  })

  describe('12px 미만 폰트 금지 검증', () => {
    it('text-[9px]/[10px]/[11px]/[11.5px] 클래스가 없어야 한다', () => {
      const { container } = render(<RouteDetailPage routeNumber="33" />)
      const allClasses = Array.from(container.querySelectorAll('[class]'))
        .map((el) => el.className)
        .join(' ')
      expect(allClasses).not.toMatch(/text-\[(9|10|11)(\.\d+)?px\]/)
    })
  })
})
