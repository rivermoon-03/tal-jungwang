import { render, screen } from '@testing-library/react'
import BusStatsHeader from './BusStatsHeader'

describe('BusStatsHeader', () => {
  it('returns null when stats is null', () => {
    const { container } = render(<BusStatsHeader stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when stats is undefined', () => {
    const { container } = render(<BusStatsHeader />)
    expect(container.firstChild).toBeNull()
  })

  it('renders mean/subtitle/sample text and the full distribution bar', () => {
    render(
      <BusStatsHeader
        stats={{
          p10_min: 1,
          p50_min: 4,
          p90_min: 9,
          mean_min: 4,
          tolerance_min: 4,
          sample_size: 28,
        }}
        dayLabel="평일"
        hourLabel="18시"
      />
    )
    expect(screen.getByText(/약 4분/)).toBeInTheDocument()
    expect(screen.getByText(/평일 · 18시/)).toBeInTheDocument()
    expect(screen.getByText(/표본 28회/)).toBeInTheDocument()
    expect(screen.getByText(/중앙값 4분/)).toBeInTheDocument()
  })
})
