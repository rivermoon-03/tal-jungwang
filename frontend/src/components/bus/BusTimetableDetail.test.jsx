import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

let isNarrowPhone = false
vi.mock('../../hooks/useMediaQuery', () => ({
  useIsNarrowPhone: () => isNarrowPhone,
}))

const mockUseBusTimetable = vi.fn(() => ({ data: null, loading: false }))
vi.mock('../../hooks/useBus', () => ({
  useBusTimetable: (...args) => mockUseBusTimetable(...args),
  useBusHistoryPreview: () => ({
    data: {
      columns: [
        {
          date: '2026-06-24',
          label: '6/24 (화)',
          day_label: '평일',
          totalCount: 2,
          times: ['08:15', '09:30'],
        },
      ],
      route_id: 'r1',
      stop_id: 's1',
    },
    loading: false,
  }),
  useBusArrivalStats: () => ({
    data: { stats: null, day_type: 'weekday', hour_of_day: 8 },
  }),
}))

vi.mock('../dashboard/busStationConfig', () => ({
  ROUTE_WAYPOINTS: { '999': true },
  getGbisStationIdForRoute: () => 'stop-1',
}))

vi.mock('./BusArrivalCard', () => ({
  RouteProgressStrip: () => <div data-testid="route-strip" />,
}))

vi.mock('./BusStatsHeader', () => ({
  default: () => <div data-testid="bus-stats-header" />,
}))

import BusTimetableDetail from './BusTimetableDetail'

function renderWaypoint() {
  return render(
    <BusTimetableDetail
      routeNo="999"
      routeId="r-999"
      stationId="s-999"
      onBack={() => {}}
    />
  )
}

describe('BusTimetableDetail — 토큰 준수 (AI티 제거)', () => {
  it('text-slate-* 클래스가 없어야 한다', () => {
    const { container } = renderWaypoint()
    const allClasses = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.className)
      .join(' ')
    expect(allClasses).not.toMatch(/\btext-slate-\d/)
  })

  it('text-gray-* 클래스가 없어야 한다', () => {
    const { container } = renderWaypoint()
    const allClasses = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.className)
      .join(' ')
    expect(allClasses).not.toMatch(/\btext-gray-\d/)
  })

  it('text-[9px] / text-[10px] / text-[11px] 클래스가 없어야 한다', () => {
    const { container } = renderWaypoint()
    const allClasses = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.className)
      .join(' ')
    expect(allClasses).not.toMatch(/text-\[(9|10|11)px\]/)
  })

  it('bg-slate-* 클래스가 없어야 한다', () => {
    const { container } = renderWaypoint()
    const allClasses = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.className)
      .join(' ')
    expect(allClasses).not.toMatch(/\bbg-slate-\d/)
  })

  it('라벨과 날짜 텍스트가 렌더링된다', () => {
    renderWaypoint()
    expect(screen.getByText('6/24 (화)')).toBeInTheDocument()
    expect(screen.getByText('평일')).toBeInTheDocument()
  })

  it('시각 목록이 렌더링된다', () => {
    renderWaypoint()
    expect(screen.getByText('08:15')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
  })

  it('총 N회 텍스트가 렌더링된다', () => {
    renderWaypoint()
    expect(screen.getByText(/총 2회/)).toBeInTheDocument()
  })
})

// ── 좁은 폰(< 360px) 가로 스크롤 스냅 — 시간표 전용 노선(비-waypoint) ──────────
function renderTimetable() {
  return render(
    <BusTimetableDetail
      routeNo="3400"
      routeId="r-3400"
      onBack={() => {}}
    />
  )
}

describe('BusTimetableDetail — 좁은 폰 가로 스크롤 스냅', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 8, 15, 0))
    mockUseBusTimetable.mockReturnValue({
      data: { times: ['08:00', '08:30', '09:00'], schedule_type: 'weekday' },
      loading: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    isNarrowPhone = false
    mockUseBusTimetable.mockReturnValue({ data: null, loading: false })
  })

  it('일반 화면에서는 세로 리스트(ul)를 렌더링한다', () => {
    isNarrowPhone = false
    const { container } = renderTimetable()
    expect(container.querySelector('ul')).not.toBeNull()
    expect(container.querySelector('.snap-x')).toBeNull()
  })

  it('좁은 화면에서는 ul 대신 가로 스크롤 스냅 스트립을 렌더링한다', () => {
    isNarrowPhone = true
    const { container } = renderTimetable()
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelector('.snap-x')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('좁은 화면에서도 "밀어서 이후 시간 보기" 힌트를 보여준다', () => {
    isNarrowPhone = true
    renderTimetable()
    expect(screen.getByText('밀어서 이후 시간 보기')).toBeInTheDocument()
  })

  it('좁은 화면에서 오늘 운행 종료 시 안내 문구를 보여준다', () => {
    isNarrowPhone = true
    mockUseBusTimetable.mockReturnValue({
      data: { times: ['08:00'], schedule_type: 'weekday' },
      loading: false,
    })
    vi.setSystemTime(new Date(2026, 6, 19, 23, 0, 0))
    renderTimetable()
    expect(screen.getByText('오늘 운행이 끝났습니다')).toBeInTheDocument()
  })
})
