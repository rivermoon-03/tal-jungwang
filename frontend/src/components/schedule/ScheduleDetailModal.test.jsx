/**
 * ScheduleDetailModal — 셔틀 경로 알림 배선 테스트(F3-3 실화면 배선).
 * ShuttleContent가 종 버튼 → ShuttleNotifySheet 오픈 → useShuttleAlarms 예약까지
 * 이어지는지, 그리고 좁은 폰에서 NarrowPhoneStrip으로 전환되는지 검증한다.
 *
 * isPC를 강제로 true로 만들어(overlay 포털) vaul Drawer(모바일 경로, jsdom에
 * ResizeObserver 등 별도 폴리필이 필요) 없이 렌더링한다. useIsNarrowPhone은
 * 별도 훅 모킹으로 좁은/보통 폭을 전환한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ScheduleDetailModal, { SHUTTLE_ALARM_ENABLED } from './ScheduleDetailModal'

// 버스 시간표는 테스트별로 바꿔야 해서(운행 종료 케이스) mock 함수로 둔다.
const busTimetable = vi.fn(() => ({ data: null, loading: false, error: null }))

vi.mock('../../hooks/useBus', () => ({
  useBusTimetable: () => ({ data: null, loading: false, error: null }),
  useBusTimetableByRoute: (...args) => busTimetable(...args),
  useBusCommuteContexts: () => ({ data: [], loading: false, error: null }),
  useBusHistoryPreview: (_routeNumber, stopId) => ({
    data: {
      route_id: 15,
      stop_id: stopId,
      stop_name: '잘못 재사용된 첫 정류장',
      columns: [{ label: '지난주', day_label: '7/25(토)', times: ['22:10'], totalCount: 1 }],
      realtime_eta: null,
      predicted_eta: null,
    },
    loading: false,
    error: null,
  }),
  useBusArrivalStats: () => ({ data: null, loading: false, error: null }),
}))

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({ scheduleViewMode: 'list', setScheduleViewMode: vi.fn() })
  ),
}))

const SHUTTLE_DATA = {
  schedule_name: '학기 시간표',
  schedule_type: 'weekday',
  directions: [
    { direction: 0, times: ['08:00', '08:30', '09:00'] },
    { direction: 1, times: ['17:00', '17:30'] },
  ],
}

vi.mock('../../hooks/useShuttle', () => ({
  useShuttleSchedule: vi.fn(() => ({ data: SHUTTLE_DATA, loading: false, error: null })),
  useShuttlePeriods: vi.fn(() => ({ data: { periods: [] }, loading: false, error: null })),
}))

let isNarrowPhone = false
vi.mock('../../hooks/useMediaQuery', () => ({
  useIsNarrowPhone: () => isNarrowPhone,
}))

const addAlarm = vi.fn().mockResolvedValue({ ok: true })
let setAlarms = []
vi.mock('../../hooks/useShuttleNotification', () => ({
  useShuttleAlarms: () => ({
    alarms: setAlarms,
    addAlarm,
    removeAlarm: vi.fn(),
    isAlarmSet: (time, direction) => setAlarms.some((a) => a.time === time && a.direction === direction),
  }),
}))

// isPC 분기(overlay 포털)를 강제해 vaul Drawer 경로(별도 jsdom 폴리필 필요)를 피한다.
// useIsNarrowPhone은 위 모듈 모킹이 담당하므로 여기서는 768px 쿼리만 고정.
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

beforeEach(() => {
  isNarrowPhone = false
  setAlarms = []
  addAlarm.mockClear()
  stubDesktopMatchMedia()
  vi.useFakeTimers()
  // 월요일(평일) 08:15 — 08:00은 지남, 08:30이 다음 등교 편.
  vi.setSystemTime(new Date(2026, 6, 20, 8, 15, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderShuttle(direction = 0) {
  return render(
    <ScheduleDetailModal
      open
      onClose={() => {}}
      type="shuttle"
      direction={direction}
      title="셔틀"
      accentColor="#1b3a6e"
    />
  )
}

// 셔틀 알림은 실기기 동작이 안 돼 화면에서 내렸다(SHUTTLE_ALARM_ENABLED=false).
// 코드를 지우지 않았으므로 테스트도 남기고 플래그로만 건너뛴다 — 복구 시 자동으로 다시 돈다.
const describeAlarm = SHUTTLE_ALARM_ENABLED ? describe : describe.skip

describeAlarm('ScheduleDetailModal — 셔틀 리스트 뷰 알림 종 버튼', () => {
  it('다음 편에 알림 종 버튼이 있고 클릭하면 해당 시각의 시트가 열린다', () => {
    renderShuttle(0)
    const bell = screen.getByLabelText('08:30 셔틀 알림 설정')
    fireEvent.click(bell)
    expect(screen.getByText('08:30 셔틀 알림')).toBeInTheDocument()
    expect(screen.getByText('등교')).toBeInTheDocument()
  })

  it('시트에서 알림 켜기를 누르면 addAlarm(time, lead, direction)이 호출된다', () => {
    renderShuttle(1)
    fireEvent.click(screen.getByLabelText('17:00 셔틀 알림 설정'))
    fireEvent.click(screen.getByText('알림 켜기'))
    expect(addAlarm).toHaveBeenCalledWith('17:00', 10, 1)
  })

  it('예약된 편은 종 아이콘이 설정됨 상태로 보인다', () => {
    setAlarms = [{ time: '08:30', lead: 10, direction: 0 }]
    renderShuttle(0)
    expect(screen.getByLabelText('08:30 셔틀 알림 설정됨')).toBeInTheDocument()
  })
})

describe('ScheduleDetailModal — 좁은 폰(< 360px) 가로 스크롤 스트립 전환', () => {
  beforeEach(() => {
    isNarrowPhone = true
  })

  it('세로 리스트 대신 가로 스크롤 스냅 스트립을 렌더링한다', () => {
    // ScheduleDetailModal의 PC overlay 경로는 createPortal로 document.body에 붙으므로
    // render()가 반환하는 container가 아니라 document 전체에서 조회한다.
    renderShuttle(0)
    expect(document.querySelector('.snap-x')).toBeInTheDocument()
    expect(screen.getByText('밀어서 이후 시간 보기')).toBeInTheDocument()
  })

  it.skipIf(!SHUTTLE_ALARM_ENABLED)('스트립 안에서도 알림 종 버튼이 동작한다', () => {
    renderShuttle(0)
    fireEvent.click(screen.getByLabelText('08:30 셔틀 알림 설정'))
    fireEvent.click(screen.getByText('알림 켜기'))
    expect(addAlarm).toHaveBeenCalledWith('08:30', 10, 0)
  })
})

describe('ScheduleDetailModal — 실시간 전용 버스 상세', () => {
  it('시간표 제목을 숨기고 각 source의 정류장명을 독립적으로 표시한다', () => {
    const commuteContext = {
      route_number: '99-2',
      group_key: 'to-wolgot',
      origin_label: '시흥터미널·이마트',
      destination_label: '월곶역',
      journey_labels: ['시흥터미널', '이마트', '월곶역'],
      sources: [
        { id: 1, type: 'realtime', role: 'boarding_arrival', stop_id: 17, display_label: '시흥터미널 승차', station_label: '한국공학대학교 시흥터미널' },
        { id: 2, type: 'realtime', role: 'boarding_arrival', stop_id: 2, display_label: '이마트 승차', station_label: '이마트' },
      ],
    }

    render(
      <ScheduleDetailModal
        open
        onClose={() => {}}
        type="bus"
        routeCode="99-2"
        routeId={15}
        category="하교"
        commuteGroup="to-wolgot"
        commuteContext={commuteContext}
        title="99-2 · 월곶역 방면"
        isRealtime
      />
    )

    expect(screen.getByText('버스 실시간 정보')).toBeInTheDocument()
    expect(screen.queryByText('버스 시간표')).not.toBeInTheDocument()
    expect(screen.getByText(/실시간 GBIS 기반 · 한국공학대학교 시흥터미널/)).toBeInTheDocument()
    expect(screen.getByText(/실시간 GBIS 기반 · 이마트/)).toBeInTheDocument()
    expect(screen.queryByText(/잘못 재사용된 첫 정류장/)).not.toBeInTheDocument()
  })
})

// 헤더 점 색이 카드 배지와 달랐던 제보(시흥33 등). 호출부가 급행 4개 노선에만
// accentColor를 넘겨서 나머지는 타입 기본색(파랑)으로 떨어지고 있었다.
describe('ScheduleDetailModal — 헤더 점 색은 카드 배지와 같은 출처', () => {
  function renderBus(routeCode, extra = {}) {
    return render(
      <ScheduleDetailModal
        open
        onClose={() => {}}
        type="bus"
        routeCode={routeCode}
        title={`${routeCode} · 정왕역 방면`}
        {...extra}
      />
    )
  }

  // 시트는 portal로 body에 붙으므로 container가 아니라 document에서 찾는다.
  const dotColor = () => document.querySelector('.w-3.h-3.rounded-full').style.background

  it('시흥33은 노선색(#0891B2)을 쓴다', () => {
    renderBus('시흥33')
    expect(dotColor()).toBe('rgb(8, 145, 178)')
  })

  it('20-1은 노선색(#2563EB)을 쓴다', () => {
    renderBus('20-1')
    expect(dotColor()).toBe('rgb(37, 99, 235)')
  })

  it('호출부가 accentColor를 명시하면 그 값이 우선한다', () => {
    renderBus('시흥33', { accentColor: '#DC2626' })
    expect(dotColor()).toBe('rgb(220, 38, 38)')
  })
})

// 제보: 셔틀 상세를 열면 그 방향만 보이고 등하교를 바꿀 수 없었다(닫았다 다시 열어야 함).
describe('ScheduleDetailModal — 셔틀 방향 전환', () => {
  it('시트 안에 등교/하교 세그먼트가 있고 전환하면 제목이 따라간다', () => {
    render(
      <ScheduleDetailModal open onClose={() => {}} type="shuttle" direction={0} title="셔틀버스 등교" />
    )
    expect(screen.getByRole('tablist', { name: '셔틀 방향 선택' })).toBeInTheDocument()
    expect(screen.getByText('셔틀버스 등교')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '하교' }))
    expect(screen.getByText('셔틀버스 하교')).toBeInTheDocument()
    // 하교(direction 1) 시간표가 그려진다 — SHUTTLE_DATA 기준 17:00
    expect(screen.getByText('17:00')).toBeInTheDocument()
  })

  it('2캠은 2캠 방향(2·3) 안에서 전환한다', () => {
    render(
      <ScheduleDetailModal open onClose={() => {}} type="shuttle" direction={2} title="2캠 셔틀버스 등교" />
    )
    expect(screen.getByText('2캠 셔틀버스 등교')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '하교' }))
    expect(screen.getByText('2캠 셔틀버스 하교')).toBeInTheDocument()
  })

  it('알림 종 버튼은 렌더하지 않는다(기능 비활성)', () => {
    render(
      <ScheduleDetailModal open onClose={() => {}} type="shuttle" direction={0} title="셔틀버스 등교" />
    )
    expect(screen.queryByLabelText(/셔틀 알림 설정/)).not.toBeInTheDocument()
  })
})

describe('ScheduleDetailModal — 버스 운행 종료 안내', () => {
  afterEach(() => {
    busTimetable.mockReturnValue({ data: null, loading: false, error: null })
  })

  it('남은 차가 없으면 상단에 종료 문구와 내일 첫차를 보여준다', () => {
    // 시스템 시각은 08:15(beforeEach) — 07:00·07:30은 모두 지난 시각
    busTimetable.mockReturnValue({
      data: { schedule_type: 'weekday', times: ['07:00', '07:30'] },
      loading: false,
      error: null,
    })
    render(
      <ScheduleDetailModal open onClose={() => {}} type="bus" routeCode="20-1" title="20-1" />
    )
    expect(screen.getByText('오늘 운행이 끝났어요')).toBeInTheDocument()
    expect(screen.getByText(/막차 07:30 출발 · 내일 첫차 07:00/)).toBeInTheDocument()
  })

  it('남은 차가 있으면 종료 문구가 없다', () => {
    busTimetable.mockReturnValue({
      data: { schedule_type: 'weekday', times: ['07:00', '09:30'] },
      loading: false,
      error: null,
    })
    render(
      <ScheduleDetailModal open onClose={() => {}} type="bus" routeCode="20-1" title="20-1" />
    )
    expect(screen.queryByText('오늘 운행이 끝났어요')).not.toBeInTheDocument()
  })
})

// 버스 리스트 뷰가 옛 평평한 PastRow/TimeRow 대신 셔틀·지하철 상세와 같은
// 시(hour) 그룹 + "지금" 앵커 규격(HourGroupTimetable)을 쓰는지 검증한다.
describe('ScheduleDetailModal — 버스 리스트 뷰는 시(hour) 그룹 + 지금 앵커 규격', () => {
  afterEach(() => {
    busTimetable.mockReturnValue({ data: null, loading: false, error: null })
  })

  it('시각을 시(hour) 단위로 묶어 헤더를 보여주고, 지난 시각과 다음 차 사이에 지금 앵커를 끼운다', () => {
    // 시스템 시각 08:15(beforeEach) — 07:30·08:00은 지남, 08:30이 다음 차.
    busTimetable.mockReturnValue({
      data: {
        schedule_type: 'weekday',
        times: ['07:30', '08:00', '08:30', '09:15'],
        origin_stop_name: '강남역',
      },
      loading: false,
      error: null,
    })
    render(
      <ScheduleDetailModal open onClose={() => {}} type="bus" routeCode="20-1" title="20-1" />
    )

    // 시(hour) 헤더 — timetableGroups.js 관례대로 앞자리 0을 유지한다.
    expect(screen.getByText('07시')).toBeInTheDocument()
    expect(screen.getByText('08시')).toBeInTheDocument()
    expect(screen.getByText('09시')).toBeInTheDocument()

    // "지금" 앵커 — anchorLabel(eta.js 위임)이 만든 문구 그대로.
    const anchor = document.querySelector('[data-testid="now-anchor-line"]')
    expect(anchor).toBeInTheDocument()
    expect(anchor).toHaveTextContent('지금 08:15 · 다음 15분')

    // 다음 차(08:30)는 앵커 뒤(같은 08시 그룹 안, 08:00 다음)에 온다 — 결함 4 재발 방지.
    // PC 경로는 createPortal로 document.body에 붙으므로 render()의 container가 아니라
    // document 전체에서 순서를 본다.
    const html = document.body.innerHTML
    expect(html.indexOf('now-anchor-line')).toBeLessThan(html.indexOf('08:30'))
    expect(html.indexOf('08:00')).toBeLessThan(html.indexOf('now-anchor-line'))
  })

  it('승차 위치를 origin_stop_name으로 보여준다(stopId가 없는 단독 호출)', () => {
    busTimetable.mockReturnValue({
      data: { schedule_type: 'weekday', times: ['09:15'], origin_stop_name: '강남역' },
      loading: false,
      error: null,
    })
    render(
      <ScheduleDetailModal open onClose={() => {}} type="bus" routeCode="20-1" title="20-1" />
    )
    expect(screen.getByText('강남역 승차')).toBeInTheDocument()
  })

  it('commute-context source 헤더가 이미 정류장명을 보여주면 승차 위치 줄을 중복 렌더하지 않는다', () => {
    busTimetable.mockReturnValue({
      data: { schedule_type: 'weekday', times: ['09:15'], origin_stop_name: '강남역' },
      loading: false,
      error: null,
    })
    const commuteContext = {
      route_number: '99-2',
      group_key: 'to-wolgot',
      origin_label: '강남역',
      destination_label: '학교',
      journey_labels: ['강남역', '학교'],
      sources: [
        { id: 1, type: 'timetable', role: 'boarding_arrival', stop_id: 17, display_label: '강남역 승차', station_label: '강남역' },
      ],
    }
    render(
      <ScheduleDetailModal
        open
        onClose={() => {}}
        type="bus"
        routeCode="99-2"
        routeId={15}
        category="하교"
        commuteGroup="to-wolgot"
        commuteContext={commuteContext}
        title="99-2 · 학교 방면"
      />
    )
    // source 헤더(h3)의 "강남역 승차" 한 번만 있어야 한다 — BusContent가 같은 문구를 또 그리면 안 된다.
    expect(screen.getAllByText('강남역 승차')).toHaveLength(1)
  })
})

// 모바일 경로가 vaul(Drawer)에서 ui/Sheet로 이관됐다 — 예전엔 이 경로를 테스트하려면
// ResizeObserver 등 별도 jsdom 폴리필이 필요해 PC 경로만 테스트했다(파일 머리말
// 참고). Sheet는 그런 요구가 없어 모바일 경로도 그대로 검증할 수 있다.
describe('ScheduleDetailModal — 모바일 경로(ui/Sheet)', () => {
  function stubMobileMatchMedia() {
    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
  }

  beforeEach(() => {
    stubMobileMatchMedia()
  })

  it('dialog role로 렌더링된다', () => {
    render(<ScheduleDetailModal open onClose={() => {}} type="bus" routeCode="20-1" title="20-1" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Escape를 누르면 onClose가 호출된다(Sheet가 처리)', () => {
    const onClose = vi.fn()
    render(<ScheduleDetailModal open onClose={onClose} type="bus" routeCode="20-1" title="20-1" />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경을 클릭하면 onClose가 호출된다', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ScheduleDetailModal open onClose={onClose} type="bus" routeCode="20-1" title="20-1" />
    )
    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('닫기 버튼이 IconButton(44px 히트 영역)이다', () => {
    render(<ScheduleDetailModal open onClose={() => {}} type="bus" routeCode="20-1" title="20-1" />)
    const closeBtn = screen.getByRole('button', { name: '닫기' })
    expect(closeBtn.className).toMatch(/min-h-\[44px\]/)
  })
})
