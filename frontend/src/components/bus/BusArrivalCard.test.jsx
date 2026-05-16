import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import BusArrivalCard from './BusArrivalCard'

// useFavorites/useApi 의존성 차단 — 카드 표시 로직만 검증.
vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

describe('BusArrivalCard — stats display', () => {
  it('shows "다음 +N분" sub when stats is absent (realtime)', () => {
    render(
      <BusArrivalCard
        arrivals={[
          { route_no: '시흥33', route_id: 12, destination: '정왕역', category: '하교', arrival_type: 'realtime', arrive_in_seconds: 180 },
          { route_no: '시흥33', route_id: 12, destination: '정왕역', category: '하교', arrival_type: 'realtime', arrive_in_seconds: 540 },
        ]}
        stationId={100}
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText(/다음 \+9분/)).toBeInTheDocument()
  })

  it('shows "보통 ±N분" sub when stats is present (realtime)', () => {
    render(
      <BusArrivalCard
        arrivals={[
          {
            route_no: '시흥33', route_id: 12, destination: '정왕역', category: '하교',
            arrival_type: 'realtime', arrive_in_seconds: 180,
            stats: { tolerance_min: 4, p10_min: 1, p50_min: 4, p90_min: 9, mean_min: 4, sample_size: 28 },
          },
        ]}
        stationId={100}
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText(/보통 ±4분/)).toBeInTheDocument()
  })
})
