import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StopsSection from './StopsSection'

const TWO_STOPS = [
  { id: 1, name: '석수역' },
  { id: 2, name: '시흥시청역' },
]

// 3401처럼 승차 정류장이 2곳 이상인 노선에서, activeStopName이 그중 하나와
// 일치하면 그 정류장에만 "실시간 ETA 기준" 표기를 붙인다(과제 §3).
describe('StopsSection — 승차 정류장 표기', () => {
  it('정류장이 2곳 이상이고 activeStopName이 일치하면 해당 정류장에만 기준 표기를 붙인다', () => {
    render(<StopsSection stops={TWO_STOPS} directionName="정왕동행" activeStopName="시흥시청역" />)
    const badges = screen.getAllByText('실시간 ETA 기준')
    expect(badges).toHaveLength(1)
    expect(screen.getByText('석수역')).toBeInTheDocument()
    expect(screen.getByText('시흥시청역')).toBeInTheDocument()
  })

  it('activeStopName이 없으면 기준 표기를 지어내지 않는다', () => {
    render(<StopsSection stops={TWO_STOPS} directionName="정왕동행" />)
    expect(screen.queryByText('실시간 ETA 기준')).not.toBeInTheDocument()
  })

  it('정류장이 1곳뿐이면 activeStopName이 일치해도 표기를 반복하지 않는다', () => {
    render(
      <StopsSection
        stops={[{ id: 1, name: '한국공학대' }]}
        directionName="정왕동행"
        activeStopName="한국공학대"
      />
    )
    expect(screen.queryByText('실시간 ETA 기준')).not.toBeInTheDocument()
  })
})
