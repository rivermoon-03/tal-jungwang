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
import ScheduleDetailModal from './ScheduleDetailModal'

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

describe('ScheduleDetailModal — 셔틀 리스트 뷰 알림 종 버튼', () => {
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

  it('스트립 안에서도 알림 종 버튼이 동작한다', () => {
    renderShuttle(0)
    fireEvent.click(screen.getByLabelText('08:30 셔틀 알림 설정'))
    fireEvent.click(screen.getByText('알림 켜기'))
    expect(addAlarm).toHaveBeenCalledWith('08:30', 10, 0)
  })
})
