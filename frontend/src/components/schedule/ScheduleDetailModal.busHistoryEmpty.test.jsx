/**
 * ScheduleDetailModal — BusHistoryContent(실시간 버스 상세의 "과거 도착 기록") 빈 상태.
 *
 * 사용자 지적: 지난주/2주 전/3주 전 세 칸이 전부 "데이터 없음"일 때 화면이
 * "데이터가 없습니다" 문단을 세 번 반복해서 보여줬다. 실제로는 프로덕션 DB
 * 수집이 최근에 시작돼 세 날짜 모두 수집 이전이라 비어 있는 게 정상이지만,
 * 화면이 이유를 말하지 않아 사용자는 고장으로 읽었다.
 *
 * history-preview API(useBusHistoryPreview)는 수집 시작 시점을 내려주지 않는다
 * (GET /api/v1/bus/history-preview/{route_number} 응답 확인 — route_number,
 * route_id, stop_id, stop_name, columns, realtime_eta, predicted_eta 뿐).
 * 그래서 없는 날짜를 지어내지 않고, 화면이 아는 사실(같은 요일 3주 비교라는
 * 구조)만으로 안내 문구 하나로 대체한다 — RouteDetailPage의 ArrivalHistory가
 * 빈 상태를 컬럼 대신 EmptyState 하나로 보여주는 것과 같은 원칙이다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ScheduleDetailModal from './ScheduleDetailModal'

const busHistoryPreview = vi.fn()

vi.mock('../../hooks/useBus', () => ({
  useBusTimetable: () => ({ data: null, loading: false, error: null }),
  useBusTimetableByRoute: () => ({ data: { times: [] }, loading: false, error: null }),
  useBusCommuteContexts: () => ({ data: [], loading: false, error: null }),
  useBusHistoryPreview: (...args) => busHistoryPreview(...args),
  useBusArrivalStats: () => ({ data: null, loading: false, error: null }),
}))

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({ scheduleViewMode: 'list', setScheduleViewMode: vi.fn() })
  ),
}))

vi.mock('../../hooks/useShuttle', () => ({
  useShuttleSchedule: vi.fn(() => ({ data: null, loading: false, error: null })),
  useShuttlePeriods: vi.fn(() => ({ data: { periods: [] }, loading: false, error: null })),
}))

vi.mock('../../hooks/useMediaQuery', () => ({
  useIsNarrowPhone: () => false,
}))

vi.mock('../../hooks/useShuttleNotification', () => ({
  useShuttleAlarms: () => ({
    alarms: [],
    addAlarm: vi.fn(),
    removeAlarm: vi.fn(),
    isAlarmSet: () => false,
  }),
}))

// isPC 분기(overlay 포털)를 강제해 모바일 Sheet(vaul, jsdom 폴리필 필요) 경로를 피한다.
function stubDesktopMatchMedia() {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('768px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

// 실시간 source가 있는 commuteContext를 직접 주입한다 — useBusCommuteContexts를
// 빈 배열로 모킹했으므로 group 매칭이 없고, ScheduleDetailModal은 이 prop을
// 그대로 activeContext로 폴백한다(그룹이 하나도 없을 때).
const REALTIME_CONTEXT = {
  group_key: 'to-jeongwang',
  route_number: '20-1',
  origin_label: '한국공학대학교',
  destination_label: '정왕역',
  journey_labels: [],
  sources: [
    {
      id: 'src-1',
      type: 'realtime',
      stop_id: 10,
      station_label: '한국공학대학교',
      display_label: '한국공학대학교',
    },
  ],
}

function renderBusHistory() {
  return render(
    <ScheduleDetailModal
      open
      onClose={() => {}}
      type="bus"
      routeCode="20-1"
      category="하교"
      commuteContext={REALTIME_CONTEXT}
      title="20-1 · 정왕역행"
    />
  )
}

beforeEach(() => {
  stubDesktopMatchMedia()
  busHistoryPreview.mockReturnValue({
    data: {
      route_id: 1,
      stop_id: 10,
      stop_name: '한국공학대학교',
      columns: [
        { label: '지난주', day_label: '8/27(목)', times: ['22:10'], totalCount: 1 },
        { label: '2주 전', day_label: '8/20(목)', times: [], totalCount: 0 },
        { label: '3주 전', day_label: '8/13(목)', times: [], totalCount: 0 },
      ],
      realtime_eta: null,
      predicted_eta: null,
    },
    loading: false,
    error: null,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ScheduleDetailModal — 과거 도착 기록, 세 컬럼 모두 빈 상태', () => {
  it('컬럼 하나라도 기록이 있으면 기존처럼 컬럼별로 렌더한다(회귀 확인)', () => {
    renderBusHistory()

    expect(screen.getByText('지난주')).toBeInTheDocument()
    expect(screen.getByText('22:10')).toBeInTheDocument()
    // 나머지 두 컬럼은 개별적으로 "데이터 없음"/"데이터가 없습니다"를 유지한다
    // (부분 공백은 "이 날짜만 기록이 없다"는 유효한 정보다).
    expect(screen.getAllByText('데이터 없음')).toHaveLength(2)
    expect(screen.getAllByText('데이터가 없습니다')).toHaveLength(2)
  })

  it('세 컬럼 모두 기록이 없으면 "데이터가 없습니다"를 세 번 반복하지 않는다', () => {
    busHistoryPreview.mockReturnValue({
      data: {
        route_id: 1,
        stop_id: 10,
        stop_name: '한국공학대학교',
        columns: [
          { label: '지난주', day_label: '8/27(목)', times: [], totalCount: 0 },
          { label: '2주 전', day_label: '8/20(목)', times: [], totalCount: 0 },
          { label: '3주 전', day_label: '8/13(목)', times: [], totalCount: 0 },
        ],
        realtime_eta: null,
        predicted_eta: null,
      },
      loading: false,
      error: null,
    })

    renderBusHistory()

    expect(screen.queryAllByText('데이터가 없습니다')).toHaveLength(0)
    expect(screen.queryAllByText('데이터 없음')).toHaveLength(0)
  })

  it('세 컬럼 모두 빈 상태면 이유를 설명하는 안내 문구를 한 번만 보여준다', () => {
    busHistoryPreview.mockReturnValue({
      data: {
        route_id: 1,
        stop_id: 10,
        stop_name: '한국공학대학교',
        columns: [
          { label: '지난주', day_label: '8/27(목)', times: [], totalCount: 0 },
          { label: '2주 전', day_label: '8/20(목)', times: [], totalCount: 0 },
          { label: '3주 전', day_label: '8/13(목)', times: [], totalCount: 0 },
        ],
        realtime_eta: null,
        predicted_eta: null,
      },
      loading: false,
      error: null,
    })

    renderBusHistory()

    expect(
      screen.getAllByText(/오늘과 같은 요일, 최근 3주 안에 쌓인 도착 기록이 없어요/)
    ).toHaveLength(1)
  })

  it('없는 날짜를 지어내지 않는다(예: 9/2 같은 수집 시작일 문구가 없다)', () => {
    busHistoryPreview.mockReturnValue({
      data: {
        route_id: 1,
        stop_id: 10,
        stop_name: '한국공학대학교',
        columns: [
          { label: '지난주', day_label: '8/27(목)', times: [], totalCount: 0 },
          { label: '2주 전', day_label: '8/20(목)', times: [], totalCount: 0 },
          { label: '3주 전', day_label: '8/13(목)', times: [], totalCount: 0 },
        ],
        realtime_eta: null,
        predicted_eta: null,
      },
      loading: false,
      error: null,
    })

    renderBusHistory()

    expect(screen.queryByText(/곧 채워/)).not.toBeInTheDocument()
    expect(screen.queryByText(/9\/2/)).not.toBeInTheDocument()
  })
})
