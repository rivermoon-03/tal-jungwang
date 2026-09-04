/**
 * SchedulePage — 즐겨찾기 필터 회귀 테스트 (결함 #20).
 *
 * 버그: 별 저장은 route_number("20-1") 또는 "${busGroup}:${routeNo}" 같은 레거시
 * 형태로 여기저기 흩어져 있었는데, "★ 즐겨찾기" 필터는 favCode("하교:20-1") 문자열과
 * 정확히 일치하는지만 봐서 실제로 별을 눌러도 필터에는 항상 "즐겨찾기한 노선이
 * 없어요"가 떴다. 이 테스트는 신규 favKey(utils/favKey.js) 저장값과 레거시
 * 저장값(순수 route_number) 양쪽 모두 필터가 인식하는지 검증한다.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import SchedulePage from './SchedulePage'
import { makeFavKey } from '../../utils/favKey'

const ROUTES = [
  {
    route_id: 1,
    route_number: '20-1',
    route_name: '시흥20-1번',
    direction_name: '아이파크아파트방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 10, name: '한국공학대학교', lat: 37.3, lng: 126.7 }],
  },
  {
    route_id: 2,
    route_number: '3400',
    route_name: null,
    direction_name: '서울행',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 11, name: '시화터미널', lat: 37.34, lng: 126.73 }],
  },
  {
    route_id: 3,
    route_number: '5200',
    route_name: '시흥5200번',
    direction_name: '신도림역방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 12, name: '시화터미널', lat: 37.34, lng: 126.73 }],
  },
  {
    route_id: 4,
    route_number: '3401',
    direction_name: '석수역방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 2, name: '이마트', lat: 37.34, lng: 126.73 }],
  },
  {
    route_id: 5,
    route_number: '5602',
    direction_name: '구로디지털단지역방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 2, name: '이마트', lat: 37.34, lng: 126.73 }],
  },
  {
    route_id: 6,
    route_number: '3400',
    direction_name: '학교방면',
    category: '등교',
    is_realtime: true,
    stops: [{ stop_id: 6, name: '강남역', lat: 37.49, lng: 127.03 }],
  },
  {
    route_id: 7,
    route_number: '6502',
    direction_name: '학교방면',
    category: '등교',
    is_realtime: true,
    stops: [{ stop_id: 5, name: '사당역', lat: 37.47, lng: 126.98 }],
  },
  {
    route_id: 9,
    route_number: '시흥1',
    direction_name: '개봉방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 2, name: '이마트', lat: 37.34, lng: 126.73 }],
  },
]

// 하교는 방면 탭 없이 노선당 한 줄(경유지 표기)로 통합한 단일 목록이다.
// BusGroupContent가 아래 네 group_key를 모두 조회해 화면에서 합친다.
// 시흥33은 실제 DB 정리(prod_migration_20260904_dedupe_hagyo_bus_commute_contexts.sql)와
// 같은 모양이다 — "학교→정왕역"(to-jeongwang)만 있는 부분 여정 컨텍스트는
// 지웠고, "학교→정왕역→시흥시청역" 전체 여정을 담은 to-siheung-city-hall
// 컨텍스트 하나만 남았다. 3401·5602도 같은 이유로 to-seoul 쪽 전체 여정만
// 남기고 to-siheung-city-hall 쪽 부분 여정은 지웠다.
const COMMUTE_CONTEXTS = {
  '하교:to-jeongwang': [
    makeContext(1, '20-1', 'to-jeongwang', '학교', '정왕역', [
      timetable(10, '학교 승차', 'to-jeongwang'),
      realtime(10, '학교 승차', 'to-jeongwang'),
    ]),
  ],
  '하교:to-siheung-city-hall': [
    makeContext(10, '시흥33', 'to-siheung-city-hall', '학교', '시흥시청', [
      realtime(10, '학교 승차', 'to-city-hall'),
    ], '하교', ['학교', '정왕역', '시흥시청']),
  ],
  '하교:to-seoul': [
    makeContext(2, '3400', 'to-seoul', '시흥터미널', '강남역', [
      timetable(11, '시흥터미널 승차'),
      realtime(2, '이마트 승차'),
    ]),
    makeContext(3, '5200', 'to-seoul', '시흥터미널', '신도림역', [realtime(12, '시흥터미널 승차')]),
    makeContext(4, '3401', 'to-seoul', '이마트', '석수역', [
      timetable(2, '이마트 승차'),
      realtime(13, '시흥시청 도착', 'to-seoul', 'downstream_arrival'),
    ]),
    makeContext(5, '5602', 'to-seoul', '이마트', '구로디지털단지역', [timetable(2, '이마트 승차')]),
    makeContext(8, '6502', 'to-seoul', '이마트', '사당역', [timetable(2, '이마트 승차')]),
    makeContext(9, '시흥1', 'to-seoul', '이마트', '개봉', [realtime(2, '이마트 승차')]),
  ],
  '하교:to-wolgot': [
    makeContext(11, '99-2', 'to-wolgot', '시흥터미널·이마트', '월곶역', [
      realtime(11, '시흥터미널 승차', 'to-wolgot'),
    ], '하교', ['시흥터미널', '이마트', '월곶역']),
  ],
  '등교:from-seoul': [
    makeContext(6, '3400', 'from-seoul', '강남역', '학교', [timetable(6, '강남역 승차')], '등교'),
    makeContext(7, '6502', 'from-seoul', '사당역', '학교', [timetable(5, '사당역 승차')], '등교'),
  ],
  '등교:from-siheung-city-hall': [],
}

function timetable(stopId, displayLabel, travelDirection = 'to-seoul') {
  return { id: stopId * 10, type: 'timetable', role: 'departure', stop_id: stopId, station_label: displayLabel.replace(/ (?:출발|도착|승차)$/, ''), display_label: displayLabel, travel_direction: travelDirection }
}

function realtime(stopId, displayLabel, travelDirection = 'to-seoul', role = 'boarding_arrival') {
  return { id: stopId * 10 + 1, type: 'realtime', role, stop_id: stopId, station_label: displayLabel.replace(/ (?:출발|도착|승차)$/, ''), display_label: displayLabel, travel_direction: travelDirection }
}

function makeContext(routeId, routeNumber, groupKey, origin, destination, sources, category = '하교', journeyLabels = null) {
  return { id: routeId * 100 + groupKey.length, route_id: routeId, route_number: routeNumber, category, group_key: groupKey, origin_label: origin, destination_label: destination, journey_labels: journeyLabels ?? [origin, destination], sources }
}

vi.mock('../../hooks/useBus', () => ({
  useBusCommuteContexts: (category, group) => ({ data: COMMUTE_CONTEXTS[`${category}:${group}`] ?? [], loading: false }),
  useBusRoutesByCategory: (category) => ({ data: ROUTES.filter((route) => route.category === category), loading: false }),
  useBusTimetable: () => ({ data: null, loading: false }),
  useBusTimetableByRoute: (routeNumber) => {
    const future = new Date(2026, 7, 3, 12, 30, 0)
    const hhmm = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`
    const hasTestTimetable = ['20-1', '3400', '3401', '5602', '6502'].includes(routeNumber)
    return { data: hasTestTimetable ? { times: [hhmm] } : null, loading: false }
  },
  useBusArrivals: (stopId) => ({
    data: stopId == null ? null : [
      ...(realtime20_1Available
        ? [{ route_no: '20-1', arrival_type: 'realtime', travel_direction: 'to-jeongwang', arrive_in_seconds: 180 }]
        : []),
      { route_no: '5200', arrival_type: 'realtime', travel_direction: 'to-seoul', arrive_in_seconds: 420 },
      { route_no: '시흥1', arrival_type: 'realtime', travel_direction: 'to-seoul', arrive_in_seconds: 300 },
    ],
    loading: false,
  }),
  useBusHistoryPreview: () => ({ data: null, loading: false }),
  useBusArrivalStats: () => ({ data: null, loading: false }),
}))

vi.mock('../../hooks/useNow', () => ({
  useNow: () => new Date(2026, 7, 3, 12, 0, 0).getTime(),
}))

vi.mock('../../hooks/useMapMarkers', () => ({
  useMapMarkers: () => ({ data: { markers: [] }, loading: false }),
}))

// 20-1(route_id=1)은 신규 favKey 스키마로, 3400은 레거시 순수 route_number("3400")로
// 저장된 상황을 재현한다. 5200은 즐겨찾기하지 않았다.
const favKeyFor20_1 = makeFavKey({ mode: 'bus', id: 1, direction: '하교' })

let favoritesState = { routes: ['3400'], stations: [], venues: [], keys: [favKeyFor20_1] }
const toggleFavoriteKey = vi.fn()
let realtime20_1Available = true

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      selectedMode: 'bus',
      setSelectedMode: vi.fn(),
      selectedShuttleCampus: 'main',
      setShuttleCampus: vi.fn(),
      scheduleHint: null,
      setScheduleHint: vi.fn(),
      favorites: favoritesState,
      toggleFavoriteKey,
      setMapPanTarget: vi.fn(),
      setSubwayDetailSheet: vi.fn(),
      scheduleViewMode: 'list',
      setScheduleViewMode: vi.fn(),
    }),
}))

beforeEach(() => {
  window.history.replaceState({}, '', '/schedule?type=bus')
  stubMatchMedia(false)
  realtime20_1Available = true
})

describe('SchedulePage — 모드 탭 URL 동기화 회귀', () => {
  it('지하철 탭 터치 후 URL과 활성 탭이 함께 지하철로 유지된다', () => {
    render(<SchedulePage />)

    const subwayTab = screen.getByRole('tab', { name: '지하철' })
    fireEvent.click(subwayTab)

    expect(window.location.search).toBe('?type=subway')
    expect(subwayTab).toHaveAttribute('aria-selected', 'true')
  })

  it('셔틀 탭 터치 후 URL과 활성 탭이 함께 셔틀로 유지된다', () => {
    render(<SchedulePage />)

    const shuttleTab = screen.getByRole('tab', { name: '셔틀' })
    fireEvent.click(shuttleTab)

    expect(window.location.search).toBe('?type=shuttle')
    expect(shuttleTab).toHaveAttribute('aria-selected', 'true')
  })
})

describe('SchedulePage — 즐겨찾기 필터(결함 #20 회귀)', () => {
  it('필터를 켜면 신규(favKey)+레거시(route_number) 저장값 모두 인식해 즐겨찾기한 노선만 보인다', () => {
    render(<SchedulePage />)

    // 하교는 방면 탭 없이 한 목록이라 필터 전에는 정왕역·서울행 노선이 함께 보인다.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText('즐겨찾기한 노선만 보기'))

    // 신규 favKey로 저장한 20-1과 레거시 route_number로 저장한 3400 모두 남고,
    // 즐겨찾기하지 않은 5200은 탭 전환 없이도 빠진다.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)
    expect(screen.queryByText('5200')).not.toBeInTheDocument()
  })
})

// ─── PC master-detail (결함 #19/#33) ────────────────────────────────────────
// 데스크톱에서 버스 행을 클릭하면 예전에는 components/bus/BusArrivalCard가 자체
// pushState 네비게이트를 실행해 전체 페이지(/route/bus:번호)로 이동, 좌측 목록이
// 사라졌다. 리디자인 후에는 라우팅 없이 우측 인라인 패널에서 렌더돼야 한다.
function stubMatchMedia(matches) {
  window.matchMedia = vi.fn((query) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe('SchedulePage — PC master-detail(결함 #19/#33 회귀)', () => {
  it('데스크톱에서 버스 행을 클릭하면 라우팅 이동 없이 우측 패널에 렌더된다(좌측 목록 유지)', () => {
    stubMatchMedia(true)
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    render(<SchedulePage />)

    // 좌측 목록(노선 리스트)이 여전히 보여야 한다 — 클릭 전 확인.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByText('20-1')[0])

    // 라우팅 이동(/route/bus:20-1) 없음 — pushState가 호출되지 않았다.
    expect(pushStateSpy).not.toHaveBeenCalled()
    // 좌측 목록이 그대로 남아있다(전체 페이지 이동으로 사라지지 않음).
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)

    pushStateSpy.mockRestore()
    stubMatchMedia(false)
  })
})

// ─── PC 홈 도킹 패널(embedded)에서의 시간표 ──────────────────────────────────
// 결함: embedded일 때도 isDesktop만 보고 위 좌(목록)/우(상세) 2단 분기를 그대로
// 탔다. PCMainShell의 aside(폭 380~440px)는 그 2단을 담기엔 너무 좁아, 상세
// 컬럼이 사실상 0폭으로 눌리는 중첩 레이아웃이 됐다. embedded에서는 목록↔상세를
// 나란히 두지 않고 드릴다운(하나만 보여주고 전환)으로 처리해야 한다.
describe('SchedulePage — PC 홈 embedded(좁은 도킹 패널) 레이아웃', () => {
  it('embedded+데스크톱에서는 좌우 2단(w-[380px] 중첩 목록) 대신 목록 하나만 그린다', () => {
    stubMatchMedia(true)
    const { container } = render(<SchedulePage embedded />)

    // 목록이 보인다.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    // /schedule 단독 페이지 전용 2단 레이아웃(중첩 w-[380px] 목록 컬럼)이 아니다.
    expect(container.querySelector('.w-\\[380px\\]')).toBeNull()

    stubMatchMedia(false)
  })

  it('embedded+데스크톱에서 노선을 클릭하면 목록 대신 상세로 전환되고(드릴다운), 닫으면 목록으로 되돌아간다', () => {
    stubMatchMedia(true)
    render(<SchedulePage embedded />)

    // 클릭 전: 목록의 그룹 탭(하교/등교/기타)이 보인다.
    expect(screen.getByRole('tab', { name: '하교' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByText('20-1')[0])

    // 상세로 드릴다운 — 목록(그룹 탭)은 좌우로 나란히 두지 않고 통째로 사라진다.
    expect(screen.queryByRole('tab', { name: '하교' })).not.toBeInTheDocument()
    const closeButton = screen.getByLabelText('닫기')
    expect(closeButton).toBeInTheDocument()

    fireEvent.click(closeButton)

    // 닫으면 목록(그룹 탭)으로 되돌아간다.
    expect(screen.getByRole('tab', { name: '하교' })).toBeInTheDocument()

    stubMatchMedia(false)
  })
})

describe('SchedulePage — 통학 맥락과 정적 시간표', () => {
  it('하교는 방면 탭 없이 한 목록으로 통합되고, 시흥33은 경유지가 담긴 카드 하나로만 노출한다', () => {
    render(<SchedulePage />)

    // 방면 탭 자체가 없다 — "정왕역 방면"/"시흥시청 방면"/"서울 방면"/"월곶역 방면"
    // 탭 전환 없이 하교 노선이 한 목록으로 보인다(사용자 지적: 시흥33이 정왕역·
    // 시흥시청 두 탭에 중복 노출되던 문제).
    expect(screen.queryByRole('tab', { name: '정왕역 방면' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '시흥시청 방면' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '서울 방면' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '월곶역 방면' })).not.toBeInTheDocument()

    // 탭 전환 없이도 네 방면 노선이 모두 한 목록에 보인다.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3401').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5602').length).toBeGreaterThan(0)
    expect(screen.getAllByText('99-2').length).toBeGreaterThan(0)

    // 시흥33은 DB에서 부분 여정(학교→정왕역) 컨텍스트를 지웠으므로 카드가
    // 하나만 존재한다 — getByTestId는 같은 testid가 둘이면 예외를 던진다.
    const route시흥33 = screen.getByTestId('bus-context-시흥33')
    expect(route시흥33).toHaveTextContent('정왕역')
    expect(route시흥33).toHaveTextContent('시흥시청')

    const route3401 = screen.getByTestId('bus-context-3401')
    expect(route3401).toHaveTextContent('이마트 승차')
    expect(route3401).toHaveTextContent('시흥시청 도착')
  })

  it('3401은 중복 컨텍스트가 정리되어 상세에도 방면 전환 탭이 뜨지 않는다', async () => {
    render(<SchedulePage />)

    fireEvent.click(screen.getAllByText('3401')[0])

    // 예전엔 3401이 시흥시청·서울 두 group_key에 중복 노출돼 상세 안에
    // "상세 방면 선택" 탭이 떴다. DB 중복을 지운 뒤로는 3401이 group_key
    // 하나(to-seoul)에만 남아 그 탭이 뜨지 않는다.
    await screen.findByText('버스 시간표')
    expect(screen.queryByRole('tablist', { name: '상세 방면 선택' })).not.toBeInTheDocument()
  })

  it('등교 서울 출발의 3400·6502는 실시간 정류장이 없어도 시간표를 바로 보여준다', () => {
    render(<SchedulePage />)

    fireEvent.click(screen.getByRole('tab', { name: '등교' }))

    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6502').length).toBeGreaterThan(0)
    expect(screen.getAllByText('시간표').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('실시간 도착 정보가 없어요')).not.toBeInTheDocument()
  })

  it('3400은 시흥터미널 시간표와 다음 정류장 이마트 실시간을 별도 행으로 표시한다', () => {
    render(<SchedulePage />)

    const card = screen.getByTestId('bus-context-3400')
    expect(card).toHaveTextContent('시흥터미널 승차')
    expect(card).toHaveTextContent('시간표')
    expect(card).toHaveTextContent('이마트 승차')
    expect(card).toHaveTextContent('실시간')
  })

  it('6502 하교는 이마트 승차 시간표만 표시한다', () => {
    render(<SchedulePage />)

    const card = screen.getByTestId('bus-context-6502')
    expect(card).toHaveTextContent('이마트 승차')
    expect(card).toHaveTextContent('시간표')
    expect(card).not.toHaveTextContent('실시간')
  })

  it('실시간 전용 시흥1은 시간표를 숨기고 카드 왼쪽에 실제 도착 시간을 표시한다', () => {
    render(<SchedulePage />)

    const card = screen.getByTestId('bus-context-시흥1')
    expect(within(card).getByTestId('schedule-time-column')).toHaveTextContent('5분')
    expect(card).toHaveTextContent('실시간')
    expect(card).not.toHaveTextContent('시간표')
    expect(card).not.toHaveTextContent('정보보기')
  })

  it('다른 정류장 혼합형 3400은 카드 왼쪽에 시흥터미널 다음 출발 시간을 표시한다', () => {
    render(<SchedulePage />)

    const card = screen.getByTestId('bus-context-3400')
    expect(within(card).getByTestId('schedule-time-column')).toHaveTextContent(/(?:29|30)분/)
    expect(card).not.toHaveTextContent('정보보기')
  })

  it('같은 정류장 혼합형 20-1은 카드 왼쪽에 실시간 도착을 우선 표시한다', () => {
    render(<SchedulePage />)

    const card = screen.getByTestId('bus-context-20-1')
    expect(within(card).getByTestId('schedule-time-column')).toHaveTextContent('3분')
    expect(within(card).getAllByText('학교 승차')).toHaveLength(2)
  })

  it('같은 정류장의 실시간 값이 없으면 20-1 카드 왼쪽은 시간표로 폴백한다', () => {
    realtime20_1Available = false
    render(<SchedulePage />)

    const card = screen.getByTestId('bus-context-20-1')
    expect(within(card).getByTestId('schedule-time-column')).toHaveTextContent(/(?:29|30)분/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('SchedulePage — 세그먼트 컨트롤 단일화', () => {
  // ui/SegmentTabs와 common/SegmentTabs 레거시 4종을 ui/SegmentedControl 하나로
  // 대체하는 리팩터(2026-09). 이 파일이 예전엔 모드 탭엔 ui/SegmentTabs를,
  // 그룹 탭엔 ui/SegmentedControl을 동시에 써서 한 화면 안에서 세그먼트 스타일이
  // 갈렸다 — 소스 스캔으로 재발을 막는다.
  it('ui/SegmentTabs 또는 common/SegmentTabs를 import하지 않는다', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(__dirname, 'SchedulePage.jsx'), 'utf8')
    const importLines = src
      .split('\n')
      .filter((line) => /^import /.test(line))
      .join('\n')
    expect(importLines).not.toMatch(/SegmentTabs/)
  })

  it('모드 탭·그룹 탭 모두 ui/SegmentedControl 하나만 쓴다', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(__dirname, 'SchedulePage.jsx'), 'utf8')
    expect(src).toMatch(/from ['"]\.\.\/ui\/SegmentedControl['"]/)
  })
})
