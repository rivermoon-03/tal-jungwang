import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BusArrivalCard from './BusArrivalCard'

// useFavorites/useApi 의존성 차단
vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

const baseRealtime = (over = {}) => ({
  route_no: '5200',
  route_id: 200,
  destination: '신도림',
  category: '하교',
  arrival_type: 'realtime',
  arrive_in_seconds: 180,
  ...over,
})

describe('BusArrivalCard — v5 layout', () => {
  it('renders from-line, head label and MiniTrack labels', () => {
    render(<BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />)
    // from-line
    expect(screen.getByText('에서 출발')).toBeInTheDocument()
    expect(screen.getAllByText('시화터미널').length).toBeGreaterThanOrEqual(1)
    // head
    expect(screen.getByText('신도림행')).toBeInTheDocument()
    // track labels (origin + waypoint + terminus)
    expect(screen.getAllByText('시화터미널').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('신천역')).toBeInTheDocument()
    expect(screen.getByText('신도림')).toBeInTheDocument()
  })

  it('renders "—" when stats present but no arrivals', () => {
    render(
      <BusArrivalCard
        arrivals={[{ route_no: '11-A', route_id: 11, destination: '정왕역', category: '하교', arrival_type: 'realtime' }]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows "다음 HH:MM" (absolute time) when stats absent', () => {
    // 540초(9분) 뒤의 절대 도착 시각으로 표시 — "+N분"은 첫 차에 누적된다고 오해될 소지.
    const fixedNow = new Date('2026-05-16T21:00:00+09:00')
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
    try {
      render(
        <BusArrivalCard
          arrivals={[
            baseRealtime({ arrive_in_seconds: 180 }),
            baseRealtime({ arrive_in_seconds: 540 }),
          ]}
          stationId="x"
          onTimetableClick={() => {}}
        />
      )
      // 21:00 + 540s = 21:09
      expect(screen.getByText(/다음 21:09/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows "보통 ±N분" when stats present', () => {
    render(
      <BusArrivalCard
        arrivals={[
          baseRealtime({
            arrive_in_seconds: 180,
            stats: { tolerance_min: 4, p10_min: 1, p50_min: 4, p90_min: 9, mean_min: 4, sample_size: 28 },
          }),
        ]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText(/보통 ±4분/)).toBeInTheDocument()
  })

  it('shows "곧" with imminent class when arrive_in_seconds < 60', () => {
    const { container } = render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 30 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('곧')).toBeInTheDocument()
    const eta = container.querySelector('[data-eta]')
    expect(eta.className).toMatch(/imminent/)
  })

  it('skips departed bus (arrive_in_seconds <= 0) and promotes next bus to primary', () => {
    // tick으로 0에 도달한 첫 차량은 "이미 출발"로 무시하고, 두 번째 차량이 primary가 된다.
    render(
      <BusArrivalCard
        arrivals={[
          baseRealtime({ arrive_in_seconds: 0 }),    // 이미 출발 — 표시 제외
          baseRealtime({ arrive_in_seconds: 600 }),  // 다음 차 → primary로 승격
        ]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    // ceil(600/60) = 10
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText('곧')).not.toBeInTheDocument()
  })

  it('shows "—" when all realtime arrivals are <=0', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 0 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders category swatch color for express chip', () => {
    const { container } = render(<BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />)
    const chip = container.querySelector('[data-route-chip]')
    expect(chip.className).toMatch(/line-express/)
  })
})
