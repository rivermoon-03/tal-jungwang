import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShuttleTimetable from './ShuttleTimetable'

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

const TIMES = [
  { depart_at: '08:00', note: null },
  { depart_at: '08:30', note: null },
  { depart_at: '09:00', note: null },
]

beforeEach(() => {
  isNarrowPhone = false
  setAlarms = []
  addAlarm.mockClear()
  // 08:15로 고정 — 08:00은 지남, 08:30이 다음 편.
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 19, 8, 15, 0))
})

describe('ShuttleTimetable — 일반 화면(세로 리스트)', () => {
  it('시각 목록을 렌더링하고 다음 편에 라벨을 붙인다', () => {
    render(<ShuttleTimetable times={TIMES} />)
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText('15분 뒤')).toBeInTheDocument()
  })

  it('각 편에 알림 종 버튼이 있고 클릭하면 해당 시각의 시트가 열린다', () => {
    render(<ShuttleTimetable times={TIMES} direction={0} />)
    const bell = screen.getByLabelText('08:30 셔틀 알림 설정')
    fireEvent.click(bell)
    expect(screen.getByText('08:30 셔틀 알림')).toBeInTheDocument()
    expect(screen.getByText('등교')).toBeInTheDocument()
  })

  it('시트에서 알림 켜기를 누르면 addAlarm(time, lead, direction)이 호출된다', () => {
    render(<ShuttleTimetable times={TIMES} direction={1} />)
    fireEvent.click(screen.getByLabelText('08:30 셔틀 알림 설정'))
    fireEvent.click(screen.getByText('알림 켜기'))
    expect(addAlarm).toHaveBeenCalledWith('08:30', 10, 1)
  })

  it('예약된 편은 종 아이콘이 설정됨 상태로 보인다', () => {
    setAlarms = [{ time: '08:30', lead: 10, direction: 0 }]
    render(<ShuttleTimetable times={TIMES} direction={0} />)
    expect(screen.getByLabelText('08:30 셔틀 알림 설정됨')).toBeInTheDocument()
  })
})

describe('ShuttleTimetable — 좁은 폰(< 360px) 가로 스크롤 스냅', () => {
  beforeEach(() => {
    isNarrowPhone = true
  })

  it('세로 리스트(ul) 대신 가로 스크롤 스트립을 렌더링한다', () => {
    const { container } = render(<ShuttleTimetable times={TIMES} />)
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('.snap-x')).toBeInTheDocument()
  })

  it('"밀어서 이후 시간 보기" 힌트를 보여준다', () => {
    render(<ShuttleTimetable times={TIMES} />)
    expect(screen.getByText('밀어서 이후 시간 보기')).toBeInTheDocument()
  })

  it('각 셀에도 알림 종 버튼이 있다', () => {
    render(<ShuttleTimetable times={TIMES} direction={2} />)
    fireEvent.click(screen.getByLabelText('08:00 셔틀 알림 설정'))
    expect(screen.getByText('제2캠퍼스 등교')).toBeInTheDocument()
  })

  it('시각 목록을 여전히 모두 렌더링한다(가로 스크롤이지 항목 누락이 아님)', () => {
    render(<ShuttleTimetable times={TIMES} />)
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })
})

describe('ShuttleTimetable — 수시운행 밴드', () => {
  it('연속된 수시운행 항목을 하나의 밴드로 묶어 보여준다', () => {
    const frequentTimes = [
      { depart_at: '17:00', note: '수시운행' },
      { depart_at: '17:10', note: '수시운행' },
      { depart_at: '18:00', note: null },
    ]
    render(<ShuttleTimetable times={frequentTimes} />)
    expect(screen.getByText('17:00 – 17:10')).toBeInTheDocument()
    expect(screen.getByText('수시운행')).toBeInTheDocument()
  })
})

describe('ShuttleTimetable — 좁은 폰 스트립의 회차편 남은 시간', () => {
  beforeEach(() => {
    isNarrowPhone = true
  })

  // 예전에는 nextLabel이 isReturn이면 남은 시간 계산을 버리고 "회차편"
  // 문구만 고정으로 보여줘, 다음 편이 회차편일 때 좁은 폰에서 남은 시간이
  // 아예 안 보이는 결함이 있었다. "회차편"이라는 사실은 서브라벨이 이미
  // 보여주므로, 다음 편 배지에는 항상 남은 시간이 떠야 한다.
  it('다음 편이 회차편이어도 남은 시간을 보여준다', () => {
    const returnTimes = [
      { depart_at: '08:00', note: '회차편 · 학교 09:00 출발' },
      { depart_at: '08:30', note: '회차편 · 학교 09:00 출발' },
    ]
    render(<ShuttleTimetable times={returnTimes} />)
    // 회차편 서브라벨(원편 안내)은 그대로 남아 있어야 한다.
    expect(screen.getAllByText('회차편').length).toBeGreaterThan(0)
    // 08:15 기준 다음 편 08:30까지 15분 — 회차편이라고 해서 이 배지가
    // "회차편"으로 덮이면 안 된다.
    expect(screen.getByText('15분 뒤')).toBeInTheDocument()
  })
})
