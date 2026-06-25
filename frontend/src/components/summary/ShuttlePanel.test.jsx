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

  it('NO_SCHEDULE 에러 시 주말·방학 미운영 안내 제목을 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SCHEDULE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/주말·방학/)).toBeInTheDocument()
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
    expect(screen.getByText(/주말·방학/)).toBeInTheDocument()
  })

  it('NO_SHUTTLE 에러 시 오늘 운행 종료 안내를 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/오늘 셔틀 운행이 끝났어요/)).toBeInTheDocument()
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
    expect(screen.getByText(/주말·방학/)).toBeInTheDocument()
  })

  it('본캠 + 토요일 + NO_SCHEDULE 시 학기 중 시간표 버튼이 없다', () => {
    mockKstDay(6)
    render(<ShuttlePanel />)
    expect(screen.queryByText(/학기 중 시간표 보기/)).not.toBeInTheDocument()
  })

  it('본캠 + 일요일 + NO_SCHEDULE 시 미운영 안내를 표시한다', () => {
    mockKstDay(0) // 일요일
    render(<ShuttlePanel />)
    expect(screen.getByText(/주말·방학/)).toBeInTheDocument()
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
    expect(screen.queryByText(/주말·방학/)).not.toBeInTheDocument()
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
    expect(screen.queryByText(/주말·방학/)).not.toBeInTheDocument()
    expect(screen.getByText('2캠 셔틀버스')).toBeInTheDocument()
  })

  it('2캠 + 토요일 + 운행종료(NO_SHUTTLE)면 운행종료 안내를 표시한다', () => {
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: NO_SHUTTLE_ERR, refetch: vi.fn() })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
    render(<ShuttlePanel />)
    expect(screen.getByText(/오늘 셔틀 운행이 끝났어요/)).toBeInTheDocument()
    expect(screen.queryByText(/주말·방학/)).not.toBeInTheDocument()
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
    expect(screen.getByText(/주말·방학/)).toBeInTheDocument()
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
    expect(container.innerHTML).not.toMatch(/border-l[-\[\b]/)
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
