import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TimetableStatTiles from './TimetableStatTiles'
import { computeTimetableSummary } from '../bus/timetableStats'

describe('TimetableStatTiles — 첫차/막차/배차 3타일', () => {
  it('summary가 null이면 아무것도 그리지 않는다', () => {
    const { container } = render(<TimetableStatTiles summary={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('첫차/막차/배차 값을 3타일로 보여준다', () => {
    const summary = computeTimetableSummary(['07:10', '07:30', '07:50', '08:10'])
    render(<TimetableStatTiles summary={summary} />)
    expect(screen.getByText('첫차')).toBeInTheDocument()
    expect(screen.getByText('07:10')).toBeInTheDocument()
    expect(screen.getByText('막차')).toBeInTheDocument()
    expect(screen.getByText('08:10')).toBeInTheDocument()
    expect(screen.getByText('배차')).toBeInTheDocument()
    expect(screen.getByText('20분')).toBeInTheDocument()
  })

  it('심야 운행 공백이 있으면 배차 계산에서 빼고 별도 문구로 안내한다', () => {
    // 00:10 다음 차가 07:00 — 390분 벌어진 공백. 나머지는 20~30분대 간격.
    const summary = computeTimetableSummary(['00:10', '00:30', '07:00', '07:30', '07:55'])
    render(<TimetableStatTiles summary={summary} />)
    expect(screen.getByText('20~30분')).toBeInTheDocument()
    expect(screen.getByText('00:30~07:00 운행 공백')).toBeInTheDocument()
  })

  it('심야 운행 공백이 없으면 안내 문구를 렌더하지 않는다', () => {
    const summary = computeTimetableSummary(['07:10', '07:30', '07:50', '08:10'])
    render(<TimetableStatTiles summary={summary} />)
    expect(screen.queryByText(/운행 공백/)).not.toBeInTheDocument()
  })
})
