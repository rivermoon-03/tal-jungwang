import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 스토어 모킹 ──
vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      selectedShuttleCampus: 'main',
      setDetailModal: vi.fn(),
    }),
  ),
}))

// ── 셔틀 훅 모킹 ──
vi.mock('../../hooks/useShuttle', () => ({
  useShuttleNext: vi.fn(() => ({
    data: { depart_at: '10:30', arrive_in_seconds: 300 },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useShuttleSchedule: vi.fn(() => ({ data: null, loading: false, error: null })),
}))

import useAppStore from '../../stores/useAppStore'
import { useShuttleNext, useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttlePanel from './ShuttlePanel'

const NO_SCHEDULE_ERR = Object.assign(new Error('NO_SCHEDULE'), { code: 'NO_SCHEDULE' })
const NO_SHUTTLE_ERR = Object.assign(new Error('NO_SHUTTLE'), { code: 'NO_SHUTTLE' })

function setMainCampus() {
  useAppStore.mockImplementation((selector) =>
    selector({ selectedShuttleCampus: 'main', setDetailModal: vi.fn() }),
  )
}

function setSecondCampus() {
  useAppStore.mockImplementation((selector) =>
    selector({ selectedShuttleCampus: 'second', setDetailModal: vi.fn() }),
  )
}

// KST 요일을 고정하는 헬퍼 (0=일, 6=토)
function mockKstDay(dayOfWeek) {
  // 2026-01-10 토(6), 2026-01-11 일(0), 2026-01-12 월(1)
  const dayMap = { 6: '2026-01-10T10:00:00+09:00', 0: '2026-01-11T10:00:00+09:00', 1: '2026-01-12T10:00:00+09:00' }
  const ts = Date.parse(dayMap[dayOfWeek])
  vi.setSystemTime(ts)
}

describe('ShuttlePanel — NO_SCHEDULE/NO_SHUTTLE 빈 상태 카피', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockKstDay(1) // 월요일(방학 케이스)
    setMainCampus()
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('NO_SCHEDULE 에러 시 "시간표가 없는 기간" 안내를 표시한다 (D1: 방학 미운행 단정 금지)', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/시간표가 없는 기간/)).toBeInTheDocument()
  })

  it('NO_SCHEDULE 안내에는 대체 시내버스(20-1·시흥33) 다음 행동이 있다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/20-1/)).toBeInTheDocument()
    expect(screen.getByText(/시흥33/)).toBeInTheDocument()
  })

  it('NO_SCHEDULE 에러 시 "학기 중 시간표 보기" 버튼이 없다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.queryByText(/학기 중 시간표 보기/)).not.toBeInTheDocument()
  })

  it('NO_SCHEDULE 에러 시 SemesterScheduleSheet(학기 중 운행 시간표)가 렌더되지 않는다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.queryByText(/학기 중 운행 시간표/)).not.toBeInTheDocument()
  })

  it('NO_SCHEDULE 에러 시 scheduleError 기반으로도 미운영 안내를 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: null, refetch: vi.fn() })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR })
    render(<ShuttlePanel />)
    expect(screen.getByText(/시간표가 없는 기간/)).toBeInTheDocument()
  })

  it('기간은 있지만 오늘 편성이 0건이면(주말) "오늘은 운행하지 않아요" + 다음 첫차를 보여준다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockImplementation((direction) => {
      // 오늘 전체 시간표(방향 없음): 기간은 있는데 directions가 비어 있음 = 미운행일
      if (direction === undefined || direction === null) {
        return {
          data: { schedule_type: 'VACATION', schedule_name: '여름방학 · 단축근무', directions: [] },
          loading: false,
          error: null,
        }
      }
      // 내일/모레 폴백(방향 지정): 월요일 첫차
      return { data: { directions: [{ direction, times: [{ depart_at: direction === 0 ? '08:41' : '09:10' }] }] }, loading: false, error: null }
    })
    render(<ShuttlePanel />)
    expect(screen.getByText('오늘은 셔틀이 운행하지 않아요')).toBeInTheDocument()
    expect(screen.getByText('다음 첫차')).toBeInTheDocument()
    expect(screen.queryByText(/운행이 끝났어요/)).not.toBeInTheDocument()
  })

  it('NO_SHUTTLE 에러 시 오늘 운행 종료 안내를 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/오늘 셔틀 운행이 끝났어요/)).toBeInTheDocument()
  })

  it('운행 종료·미운행 빈 상태에는 "시간표 보기" 버튼이 있다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByRole('button', { name: '시간표 보기' })).toBeInTheDocument()
  })

  it('NO_SHUTTLE 에러 + 내일 첫차 정보가 있으면 "답이 있는 빈 상태" nextInfo 카드를 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockImplementation((direction) => {
      if (direction === 0) {
        return { data: { directions: [{ direction: 0, times: [{ depart_at: '07:40' }] }] }, loading: false, error: null }
      }
      if (direction === 1) {
        return { data: { directions: [{ direction: 1, times: [{ depart_at: '15:20' }] }] }, loading: false, error: null }
      }
      return { data: null, loading: false, error: null }
    })
    render(<ShuttlePanel />)
    expect(screen.getByText('내일 첫차')).toBeInTheDocument()
    expect(screen.getByText('07:40')).toBeInTheDocument()
    expect(screen.getByText('등교 07:40 · 하교 15:20')).toBeInTheDocument()
  })

  it('NO_SHUTTLE 에러 + 내일 첫차 정보가 전혀 없으면 안내 문구로 폴백한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
    render(<ShuttlePanel />)
    expect(screen.getByText('내일 첫차 시간을 확인해 주세요')).toBeInTheDocument()
    expect(screen.queryByText('내일 첫차')).not.toBeInTheDocument()
  })

  it('일반 에러 시 ErrorState를 표시하고 재시도 버튼이 있다', () => {
    const err = Object.assign(new Error('NETWORK_ERR'), { code: 'NETWORK_ERR' })
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/셔틀 정보 오류/)).toBeInTheDocument()
  })
})

describe('ShuttlePanel — 본캠 주말 미운영', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setMainCampus()
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('본캠 + 토요일 + NO_SCHEDULE 시 미운영 안내를 표시한다', () => {
    mockKstDay(6) // 토요일
    render(<ShuttlePanel />)
    expect(screen.getByText(/시간표가 없는 기간/)).toBeInTheDocument()
  })

  it('본캠 + 토요일 + NO_SCHEDULE 시 학기 중 시간표 버튼이 없다', () => {
    mockKstDay(6)
    render(<ShuttlePanel />)
    expect(screen.queryByText(/학기 중 시간표 보기/)).not.toBeInTheDocument()
  })

  it('본캠 + 일요일 + NO_SCHEDULE 시 미운영 안내를 표시한다', () => {
    mockKstDay(0) // 일요일
    render(<ShuttlePanel />)
    expect(screen.getByText(/시간표가 없는 기간/)).toBeInTheDocument()
  })
})

describe('ShuttlePanel — 2캠 + 토요일 예외: 정상 흐름', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockKstDay(6) // 토요일
    setSecondCampus()
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('2캠 + 토요일 + 정상 데이터 시 미운영 안내가 없고 2캠 셔틀버스가 표시된다', () => {
    useShuttleNext.mockReturnValue({
      data: { depart_at: '10:00', arrive_in_seconds: 600 },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<ShuttlePanel />)
    expect(screen.queryByText(/시간표가 없는 기간/)).not.toBeInTheDocument()
    expect(screen.getByText('2캠 셔틀버스')).toBeInTheDocument()
  })

  it('2캠 + 토요일 + NO_SCHEDULE이어도 isSecondCampusSaturday면 미운영 단정 안 함(scheduleError 무시)', () => {
    // 2캠 토요일: scheduleError가 NO_SCHEDULE이어도 useShuttleNext가 데이터를 주면 정상 표시
    useShuttleNext.mockReturnValue({
      data: { depart_at: '10:00', arrive_in_seconds: 600 },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR })
    render(<ShuttlePanel />)
    expect(screen.queryByText(/시간표가 없는 기간/)).not.toBeInTheDocument()
    expect(screen.getByText('2캠 셔틀버스')).toBeInTheDocument()
  })

  it('2캠 + 토요일 + 운행종료(NO_SHUTTLE)면 운행종료 안내를 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
    render(<ShuttlePanel />)
    expect(screen.getByText(/오늘 셔틀 운행이 끝났어요/)).toBeInTheDocument()
    expect(screen.queryByText(/시간표가 없는 기간/)).not.toBeInTheDocument()
  })
})

describe('ShuttlePanel — 2캠 + 일요일: 미운영', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockKstDay(0) // 일요일
    setSecondCampus()
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('2캠 + 일요일 + NO_SCHEDULE 시 미운영 안내를 표시한다', () => {
    render(<ShuttlePanel />)
    expect(screen.getByText(/시간표가 없는 기간/)).toBeInTheDocument()
  })

  it('2캠 + 일요일 + NO_SCHEDULE 시 "학기 중 시간표 보기" 버튼이 없다', () => {
    render(<ShuttlePanel />)
    expect(screen.queryByText(/학기 중 시간표 보기/)).not.toBeInTheDocument()
  })
})

describe('ShuttlePanel — AI티 제거 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockKstDay(1) // 월요일
    setMainCampus()
    useShuttleNext.mockReturnValue({
      data: { depart_at: '10:30', arrive_in_seconds: 300 },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('slate/gray 생색 클래스를 사용하지 않는다', () => {
    const { container } = render(<ShuttlePanel />)
    expect(container.innerHTML).not.toMatch(/\btext-slate-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\btext-gray-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\bbg-slate-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\bbg-gray-\d+\b/)
  })

  it('9~11px 인라인 폰트 크기를 사용하지 않는다', () => {
    const { container } = render(<ShuttlePanel />)
    expect(container.innerHTML).not.toMatch(/font-size:\s*(9|10|11)px/)
    expect(container.innerHTML).not.toMatch(/fontSize['":\s]+(9|10|11)(?:px)?['",\s]/)
  })

  it('좌측 바(border-l, border-left) 클래스를 사용하지 않는다', () => {
    const { container } = render(<ShuttlePanel />)
    expect(container.innerHTML).not.toMatch(/border-l[-[\b]/)
    expect(container.innerHTML).not.toMatch(/border-left/)
  })

  it('셔틀버스 lineName을 렌더한다', () => {
    render(<ShuttlePanel />)
    expect(screen.getByText('셔틀버스')).toBeInTheDocument()
  })

  it('등교 방향 텍스트를 렌더한다', () => {
    render(<ShuttlePanel />)
    expect(screen.getByText(/등교/)).toBeInTheDocument()
  })

  it('하교 방향 텍스트를 렌더한다', () => {
    render(<ShuttlePanel />)
    expect(screen.getByText(/하교/)).toBeInTheDocument()
  })
})

describe('ShuttlePanel — 등교/하교 카드 크기 통일(size=lg 승격 없음)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockKstDay(1) // 월요일
    setMainCampus()
    // direction별로 다른 도착 정보를 줘 등교가 하교보다 훨씬 빨리 오게 만든다.
    // (구현 전에는 이 경우 등교 카드만 size='lg'로 승격됐다.)
    useShuttleNext.mockImplementation((direction) => ({
      data: { depart_at: '10:30', arrive_in_seconds: direction === 0 ? 120 : 900 },
      loading: false,
      error: null,
      refetch: vi.fn(),
    }))
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('등교가 하교보다 훨씬 빨리 와도 두 카드의 크기가 같다', () => {
    const { container } = render(<ShuttlePanel />)
    const sizedCards = container.querySelectorAll('[data-size]')
    expect(sizedCards).toHaveLength(2)
    expect(sizedCards[0].dataset.size).toBe(sizedCards[1].dataset.size)
    expect(sizedCards[0].dataset.size).toBe('md')
  })
})

describe('ShuttlePanel — 셔틀 타일 라벨', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockKstDay(1) // 월요일
    setMainCampus()
    useShuttleNext.mockReturnValue({
      data: { depart_at: '10:30', arrive_in_seconds: 300 },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('셔틀 타일에 잘린 한 글자("셔") 대신 "셔틀"을 온전히 보여준다', () => {
    render(<ShuttlePanel />)
    expect(screen.getAllByText('셔틀')).toHaveLength(2)
    expect(screen.queryByText('셔', { exact: true })).not.toBeInTheDocument()
  })
})

// 새벽에 홈을 열면 다음 셔틀까지 8시간 넘게 남아 "511분" 이 그대로 찍혔다.
// utils/eta.js 가 60분 초과는 절대 시각으로 바꾸라고 정해 뒀는데 이 패널만
// 안 따르고 있었다. 시간표 데이터라 예정 출발 시각을 이미 아는 만큼 그 값을 쓴다.
describe('ShuttlePanel — 60분을 넘는 대기는 시각으로 보여준다', () => {
  const nextPayload = (arriveSec, nextSec) => ({
    data: {
      direction: 0,
      depart_at: '08:40:00',
      arrive_in_seconds: arriveSec,
      is_last: false,
      note: null,
      next_depart_at: '08:50:00',
      next_arrive_in_seconds: nextSec,
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })

  it('8시간 넘게 남으면 분이 아니라 출발 시각(08:40)을 보여준다', () => {
    useShuttleNext.mockReturnValue(nextPayload(29806, 30406))
    render(<ShuttlePanel />)
    expect(screen.getAllByText('08:40').length).toBeGreaterThan(0)
    expect(screen.queryByText(/\b4\d\d분|\b5\d\d분/)).toBeNull()
  })

  it('60분 이하는 그대로 분으로 보여준다', () => {
    useShuttleNext.mockReturnValue(nextPayload(600, 1200))
    render(<ShuttlePanel />)
    expect(screen.getAllByText('10분').length).toBeGreaterThan(0)
  })
})
