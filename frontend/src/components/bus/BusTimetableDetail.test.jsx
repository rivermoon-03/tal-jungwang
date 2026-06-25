import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../hooks/useBus', () => ({
  useBusTimetable: () => ({ data: null, loading: false }),
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
