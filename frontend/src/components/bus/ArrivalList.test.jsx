import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ArrivalList from './ArrivalList'

vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

// ArrivalList 헤더 자체에서 금지 클래스를 직접 쿼리
// BusArrivalCard 내부는 이번 범위 밖이므로 헤더 span만 체크
describe('ArrivalList', () => {
  describe('AI티 제거 검증', () => {
    it('카테고리 서브헤더에 10px 이하 클래스 없음', () => {
      const arrivals = [
        { route_no: '시흥33', category: '하교', arrive_in_seconds: 240, arrival_type: 'realtime' },
        { route_no: '5200',  category: '하교', arrive_in_seconds: 180, arrival_type: 'realtime' },
      ]
      const { container } = render(<ArrivalList arrivals={arrivals} stationId="x" />)
      // 헤더 행: flex items-center gap-2.5 px-1 pt-1 pb-1.5
      const headers = container.querySelectorAll('.flex.items-center.gap-2\\.5.px-1')
      expect(headers.length).toBeGreaterThan(0)
      for (const hdr of headers) {
        const html = hdr.outerHTML
        expect(html, '헤더에 text-[10px] 없음').not.toContain('text-[10px]')
        expect(html, '헤더에 text-[9px] 없음').not.toContain('text-[9px]')
        expect(html, '헤더에 text-[11px] 없음').not.toContain('text-[11px]')
        expect(html, '헤더에 uppercase 없음').not.toContain('uppercase')
        expect(html, '헤더에 tracking-[.08em] 없음').not.toContain('tracking-[.08em]')
        // 22px 인라인 색배지(w-[22px]) 대신 RouteBadge 사용해야 함
        expect(html, '헤더에 w-[22px] h-[22px] 인라인 색배지 없음').not.toContain('w-[22px]')
      }
    })

    it('상단 topCategory 헤더에 10~11px uppercase 없음 (멀티 카테고리)', () => {
      const arrivals = [
        { route_no: '6502', category: '등교', arrive_in_seconds: 100, arrival_type: 'realtime' },
        { route_no: '시흥33', category: '하교', arrive_in_seconds: 240, arrival_type: 'realtime' },
      ]
      const { container } = render(<ArrivalList arrivals={arrivals} stationId="x" />)
      // 카테고리 최상단 헤더 텍스트
      const topHdrs = container.querySelectorAll('[class*="mb-2.5"]')
      for (const hdr of topHdrs) {
        const html = hdr.outerHTML
        expect(html, 'top 헤더에 text-[11px] 없음').not.toContain('text-[11px]')
        expect(html, 'top 헤더에 uppercase 없음').not.toContain('uppercase')
        expect(html, 'top 헤더에 tracking-[.08em] 없음').not.toContain('tracking-[.08em]')
      }
    })
  })

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
