/**
 * ScheduleDetailModal — 버스 상황 제보 UI 제거 회귀 테스트.
 *
 * BusContent 하단에 있던 "지금 상황 제보" 문구와 "만차로 지나갔어요"/
 * "시간 지나도 안 와요" 버튼 두 개, 제보 완료 문구를 2026-09에 걷어냈다.
 * 이 테스트는 시간표 소스가 있는 버스 상세를 렌더해 그 문구들이 다시
 * 나타나지 않는지 고정한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ScheduleDetailModal from './ScheduleDetailModal'

vi.mock('../../hooks/useBus', () => ({
  useBusTimetable: () => ({ data: null, loading: false, error: null }),
  useBusTimetableByRoute: () => ({
    data: { times: ['08:00', '08:30', '09:00'] },
    loading: false,
    error: null,
  }),
  useBusCommuteContexts: () => ({ data: [], loading: false, error: null }),
  useBusHistoryPreview: () => ({ data: null, loading: false, error: null }),
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

// 시간표 타입 source를 하나 가진 commuteContext — BusContextDetail이 이걸 골라
// stopId를 넘겨 BusContent를 렌더한다(예전엔 그 아래에 제보 행이 붙었다).
const TIMETABLE_CONTEXT = {
  group_key: 'to-jeongwang',
  route_number: '20-1',
  origin_label: '한국공학대학교',
  destination_label: '정왕역',
  journey_labels: [],
  sources: [
    {
      id: 'src-1',
      type: 'timetable',
      stop_id: 10,
      station_label: '한국공학대학교',
      display_label: '한국공학대학교',
    },
  ],
}

function renderBusContent() {
  return render(
    <ScheduleDetailModal
      open
      onClose={() => {}}
      type="bus"
      routeCode="20-1"
      category="하교"
      commuteContext={TIMETABLE_CONTEXT}
      title="20-1 · 정왕역행"
    />
  )
}

beforeEach(() => {
  stubDesktopMatchMedia()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ScheduleDetailModal — 버스 상황 제보 UI가 다시 나타나지 않는다', () => {
  it('시간표가 있는 버스 상세를 렌더한다(회귀 확인 — 제보 UI를 찾을 화면 자체가 살아있음)', () => {
    renderBusContent()
    expect(screen.getByText('08:00')).toBeInTheDocument()
  })

  it('"지금 상황 제보" 안내 문구가 없다', () => {
    renderBusContent()
    expect(screen.queryByText(/지금 상황 제보/)).not.toBeInTheDocument()
  })

  it('"만차로 지나갔어요" 버튼이 없다', () => {
    renderBusContent()
    expect(screen.queryByText('만차로 지나갔어요')).not.toBeInTheDocument()
  })

  it('"시간 지나도 안 와요" 버튼이 없다', () => {
    renderBusContent()
    expect(screen.queryByText('시간 지나도 안 와요')).not.toBeInTheDocument()
  })

  it('제보 완료 문구가 없다', () => {
    renderBusContent()
    expect(screen.queryByText(/제보 완료/)).not.toBeInTheDocument()
  })
})
