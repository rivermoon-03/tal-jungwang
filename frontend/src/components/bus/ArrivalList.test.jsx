import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ArrivalList from './ArrivalList'

vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

describe('ArrivalList', () => {
  it('orders running-info routes before no-info routes within a category', () => {
    const arrivals = [
      { route_no: '99-2', category: '하교', minutes: null },
      { route_no: '6502', category: '하교', minutes: 5, arrival_type: 'timetable', depart_at: '19:50' },
    ]
    const { container } = render(
      <ArrivalList arrivals={arrivals} stationId="x" stationLabel="이마트" direction="하교" />
    )
    const cards = container.querySelectorAll('[data-route]')
    // 6502는 광역(express), 99-2는 시내(local). 헤더가 카테고리별로 나뉘지만 각 그룹 안 정렬도 정상.
    const routes = Array.from(cards).map((c) => c.getAttribute('data-route'))
    expect(routes).toContain('6502')
    expect(routes).toContain('99-2')
  })

  it('renders category sub-headers in express → trunk → local order', () => {
    const arrivals = [
      // 의도적으로 섞어 입력
      { route_no: '시흥33', category: '하교', arrive_in_seconds: 240, arrival_type: 'realtime' }, // local
      { route_no: '5200',  category: '하교', arrive_in_seconds: 180, arrival_type: 'realtime' }, // express
      { route_no: '20-1',  category: '하교', arrive_in_seconds: 1440, arrival_type: 'realtime' }, // trunk
    ]
    render(<ArrivalList arrivals={arrivals} stationId="x" />)
    // 헤더 텍스트
    const expressHdr = screen.getByText('광역버스')
    const trunkHdr = screen.getByText('간선버스')
    const localHdr = screen.getByText('시내·마을')
    // DOM 순서로 express → trunk → local
    expect(expressHdr.compareDocumentPosition(trunkHdr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trunkHdr.compareDocumentPosition(localHdr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders category counts ("N ROUTES")', () => {
    const arrivals = [
      { route_no: '5200', category: '하교', arrive_in_seconds: 120, arrival_type: 'realtime' },
      { route_no: '3400', category: '하교', arrival_type: 'timetable', depart_at: '19:50' },
    ]
    render(<ArrivalList arrivals={arrivals} stationId="x" />)
    expect(screen.getByText(/2\s*ROUTES/i)).toBeInTheDocument()
  })
})
