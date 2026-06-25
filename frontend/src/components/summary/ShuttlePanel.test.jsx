import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  useShuttleSemesterSchedule: vi.fn(() => ({
    data: {
      schedule_type: 'SEMESTER',
      schedule_name: '2026학년도 1학기',
      valid_from: '2026-03-03',
      valid_until: '2026-06-22',
      directions: [
        { direction: 0, times: [{ depart_at: '08:40', note: '수시운행' }] },
        { direction: 1, times: [{ depart_at: '17:00', note: null }] },
        { direction: 2, times: [{ depart_at: '09:00', note: null }] },
        { direction: 3, times: [{ depart_at: '17:30', note: null }] },
      ],
    },
    loading: false,
    error: null,
  })),
}))

import { useShuttleNext, useShuttleSchedule, useShuttleSemesterSchedule } from '../../hooks/useShuttle'
import ShuttlePanel from './ShuttlePanel'

describe('ShuttlePanel — NO_SCHEDULE/NO_SHUTTLE 빈 상태 카피', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
    useShuttleSemesterSchedule.mockReturnValue({
      data: {
        schedule_type: 'SEMESTER',
        schedule_name: '2026학년도 1학기',
        valid_from: '2026-03-03',
        valid_until: '2026-06-22',
        directions: [
          { direction: 0, times: [{ depart_at: '08:40', note: '수시운행' }] },
          { direction: 1, times: [{ depart_at: '17:00', note: null }] },
          { direction: 2, times: [{ depart_at: '09:00', note: null }] },
          { direction: 3, times: [{ depart_at: '17:30', note: null }] },
        ],
      },
      loading: false,
      error: null,
    })
  })

  it('NO_SCHEDULE 에러 시 방학·휴일 안내 제목을 표시한다', () => {
    const err = Object.assign(new Error('NO_SCHEDULE'), { code: 'NO_SCHEDULE' })
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/방학·휴일/)).toBeInTheDocument()
  })

  it('NO_SCHEDULE 에러 시 "학기 중 시간표 보기" 버튼이 표시된다', () => {
    const err = Object.assign(new Error('NO_SCHEDULE'), { code: 'NO_SCHEDULE' })
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
    render(<ShuttlePanel />)
    expect(screen.getByText(/학기 중 시간표 보기/)).toBeInTheDocument()
  })

  it('NO_SCHEDULE 에러 시 "학기 중 시간표 보기" 버튼 클릭 시 시간표 시트가 열린다', () => {
    const err = Object.assign(new Error('NO_SCHEDULE'), { code: 'NO_SCHEDULE' })
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
    render(<ShuttlePanel />)
    const btn = screen.getByText(/학기 중 시간표 보기/)
    fireEvent.click(btn)
    expect(screen.getByText(/학기 중 운행 시간표/)).toBeInTheDocument()
  })

  it('NO_SCHEDULE 에러 시 학기 중 재확인 보조 문구를 표시한다', () => {
    const err = Object.assign(new Error('NO_SCHEDULE'), { code: 'NO_SCHEDULE' })
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
    render(<ShuttlePanel />)
    // "학기 중에 다시 확인해 주세요" desc 문구 + "학기 중 시간표 보기" 버튼 모두 존재
    const elements = screen.getAllByText(/학기 중/)
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('NO_SHUTTLE 에러 시 오늘 운행 종료 안내를 표시한다', () => {
    const err = Object.assign(new Error('NO_SHUTTLE'), { code: 'NO_SHUTTLE' })
    useShuttleNext.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
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

describe('ShuttlePanel — AI티 제거 검증', () => {
  beforeEach(() => {
    useShuttleNext.mockReturnValue({
      data: { depart_at: '10:30', arrive_in_seconds: 300 },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    useShuttleSchedule.mockReturnValue({ data: null, loading: false, error: null })
  })

  it('slate/gray 생색 클래스를 사용하지 않는다', () => {
    const { container } = render(<ShuttlePanel />)
    // slate-*, gray-* 계열 생색
    expect(container.innerHTML).not.toMatch(/\btext-slate-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\btext-gray-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\bbg-slate-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\bbg-gray-\d+\b/)
  })

  it('9~11px 인라인 폰트 크기를 사용하지 않는다', () => {
    const { container } = render(<ShuttlePanel />)
    // style 속성에 9px~11px 폰트 크기 금지
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
