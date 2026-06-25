/**
 * SemesterScheduleSheet 테스트 (탭 셀렉터 방식)
 * - 탭 4개("본캠 - 등교", "본캠 - 하교", "2캠 - 등교", "2캠 - 하교") 렌더
 * - 기본 탭: "본캠 - 등교" (direction 0) — 해당 시간표만 보임
 * - 탭 클릭 시 해당 방향 시간표로 전환, 나머지 미표시
 * - 헤더(학기명/기간/안내) 유지
 * - 방향 데이터 없으면 "운행 정보 없음" 표시
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// useShuttleSemesterSchedule 모킹
vi.mock('../../hooks/useShuttle', () => ({
  useShuttleSemesterSchedule: vi.fn(),
}))

// ShuttleTimetable 모킹 (times prop을 data-testid에 반영)
vi.mock('./ShuttleTimetable', () => ({
  default: ({ times }) => (
    <ul data-testid="shuttle-timetable">
      {times.map((t) => (
        <li key={t.depart_at}>{t.depart_at}</li>
      ))}
    </ul>
  ),
}))

// createPortal 을 인라인으로 렌더
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, createPortal: (node) => node }
})

import { useShuttleSemesterSchedule } from '../../hooks/useShuttle'
import SemesterScheduleSheet from './SemesterScheduleSheet'

const MOCK_DATA = {
  schedule_type: 'SEMESTER',
  schedule_name: '2026학년도 1학기',
  valid_from: '2026-03-03',
  valid_until: '2026-06-22',
  directions: [
    { direction: 0, times: [{ depart_at: '08:40', note: null }] },
    { direction: 1, times: [{ depart_at: '17:00', note: null }] },
    { direction: 2, times: [{ depart_at: '09:00', note: null }] },
    { direction: 3, times: [{ depart_at: '17:30', note: null }] },
  ],
}

function makeOk(data = MOCK_DATA) {
  return { data, loading: false, error: null }
}

describe('SemesterScheduleSheet — 탭 셀렉터 렌더', () => {
  beforeEach(() => {
    useShuttleSemesterSchedule.mockReturnValue(makeOk())
  })

  it('open=false 이면 아무것도 렌더하지 않는다', () => {
    const { container } = render(
      <SemesterScheduleSheet open={false} onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('탭 4개가 모두 렌더된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    expect(screen.getByRole('tab', { name: '본캠 - 등교' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '본캠 - 하교' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '2캠 - 등교' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '2캠 - 하교' })).toBeInTheDocument()
  })

  it('기본 탭은 "본캠 - 등교"(direction 0)이다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    const tab = screen.getByRole('tab', { name: '본캠 - 등교' })
    expect(tab).toHaveAttribute('aria-selected', 'true')
  })

  it('기본 탭에서 본캠 - 등교 시간표(08:40)만 보인다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    expect(screen.getByText('08:40')).toBeInTheDocument()
    expect(screen.queryByText('17:00')).not.toBeInTheDocument()
    expect(screen.queryByText('09:00')).not.toBeInTheDocument()
    expect(screen.queryByText('17:30')).not.toBeInTheDocument()
  })
})

describe('SemesterScheduleSheet — 탭 전환', () => {
  beforeEach(() => {
    useShuttleSemesterSchedule.mockReturnValue(makeOk())
  })

  it('"본캠 - 하교" 탭 클릭 시 17:00 시간표가 표시된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: '본캠 - 하교' }))
    expect(screen.getByText('17:00')).toBeInTheDocument()
    expect(screen.queryByText('08:40')).not.toBeInTheDocument()
  })

  it('"2캠 - 등교" 탭 클릭 시 09:00 시간표가 표시된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: '2캠 - 등교' }))
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.queryByText('08:40')).not.toBeInTheDocument()
    expect(screen.queryByText('17:00')).not.toBeInTheDocument()
  })

  it('"2캠 - 하교" 탭 클릭 시 17:30 시간표가 표시된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: '2캠 - 하교' }))
    expect(screen.getByText('17:30')).toBeInTheDocument()
    expect(screen.queryByText('08:40')).not.toBeInTheDocument()
  })

  it('탭 클릭 시 선택된 탭의 aria-selected가 true가 된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: '2캠 - 하교' }))
    expect(screen.getByRole('tab', { name: '2캠 - 하교' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '본캠 - 등교' })).toHaveAttribute('aria-selected', 'false')
  })

  it('한 번에 하나의 시간표만 표시된다(ShuttleTimetable 1개)', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    const timetables = screen.getAllByTestId('shuttle-timetable')
    expect(timetables).toHaveLength(1)
  })
})

describe('SemesterScheduleSheet — 헤더 유지', () => {
  beforeEach(() => {
    useShuttleSemesterSchedule.mockReturnValue(makeOk())
  })

  it('헤더에 학기명이 표시된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    expect(screen.getByText(/2026학년도 1학기/)).toBeInTheDocument()
  })

  it('헤더에 기간 정보가 표시된다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    expect(screen.getByText(/2026-03-03/)).toBeInTheDocument()
  })

  it('"평일 기준" 안내 문구가 있다', () => {
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    expect(screen.getByText(/평일 기준/)).toBeInTheDocument()
  })
})

describe('SemesterScheduleSheet — 빈 데이터 처리', () => {
  it('선택된 방향 데이터가 없으면 "운행 정보 없음" 을 표시한다', () => {
    const dataWithoutDir0 = {
      ...MOCK_DATA,
      directions: MOCK_DATA.directions.filter((d) => d.direction !== 0),
    }
    useShuttleSemesterSchedule.mockReturnValue(makeOk(dataWithoutDir0))
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    // 기본 탭(direction 0)이 비어있으므로 "운행 정보 없음" 표시
    expect(screen.getByText(/운행 정보 없음/)).toBeInTheDocument()
  })

  it('다른 탭으로 전환 시 해당 방향 데이터 없으면 "운행 정보 없음" 을 표시한다', () => {
    const dataWithoutDir1 = {
      ...MOCK_DATA,
      directions: MOCK_DATA.directions.filter((d) => d.direction !== 1),
    }
    useShuttleSemesterSchedule.mockReturnValue(makeOk(dataWithoutDir1))
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: '본캠 - 하교' }))
    expect(screen.getByText(/운행 정보 없음/)).toBeInTheDocument()
  })

  it('로딩 중이면 Skeleton을 표시하고 탭 시간표가 없다', () => {
    useShuttleSemesterSchedule.mockReturnValue({ data: null, loading: true, error: null })
    render(<SemesterScheduleSheet open onClose={() => {}} />)
    expect(screen.queryByTestId('shuttle-timetable')).not.toBeInTheDocument()
  })
})
