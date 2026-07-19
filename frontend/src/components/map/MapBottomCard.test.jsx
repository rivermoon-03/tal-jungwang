import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapBottomCard from './MapBottomCard'

const ROUTES = [
  { id: 'r1', badge: '직', color: '#dc2626', name: '3400 광역급행', etaText: '7분', sub: '강남역 방면' },
  { id: 'r2', badge: '셔', color: '#12a594', name: '순환 셔틀', etaText: '14분', sub: 'TIP 정문' },
  { id: 'r3', badge: '4', color: '#1B5FAD', name: '4호선 정왕', etaText: '지연', sub: '오이도 방면', tone: 'delayed' },
]

const PRIMARY = {
  routeName: '3400 학교행',
  direction: '강남역 방면',
  etaText: '17',
  nextText: '다음 차 16:30',
  lastText: '막차 23:35',
}

describe('MapBottomCard', () => {
  it('정류장명과 상태 라벨을 렌더한다', () => {
    render(
      <MapBottomCard
        stationName="정왕역 정류장"
        live
        statusLabel="여유"
        statusTone="ease"
        primary={PRIMARY}
        routes={ROUTES}
      />
    )
    expect(screen.getByText('정왕역 정류장')).toBeInTheDocument()
    expect(screen.getByText('여유')).toBeInTheDocument()
    expect(screen.getByText('실시간')).toBeInTheDocument()
  })

  it('primary ETA와 다음차/막차 보조 텍스트를 렌더한다', () => {
    render(<MapBottomCard stationName="정왕역 정류장" primary={PRIMARY} routes={ROUTES} />)
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('다음 차 16:30 · 막차 23:35')).toBeInTheDocument()
  })

  it('가로 미니 라우트 카드의 노선명과 ETA가 모두 렌더된다', () => {
    render(<MapBottomCard stationName="정왕역 정류장" primary={PRIMARY} routes={ROUTES} />)
    expect(screen.getByText('3400 광역급행')).toBeInTheDocument()
    expect(screen.getByText('7분')).toBeInTheDocument()
    expect(screen.getByText('순환 셔틀')).toBeInTheDocument()
    expect(screen.getByText('14분')).toBeInTheDocument()
    expect(screen.getByText('4호선 정왕')).toBeInTheDocument()
    expect(screen.getByText('지연')).toBeInTheDocument()
  })

  it('미니 라우트 카드 클릭 시 onSelectRoute가 해당 id로 호출된다', () => {
    const onSelectRoute = vi.fn()
    render(
      <MapBottomCard
        stationName="정왕역 정류장"
        primary={PRIMARY}
        routes={ROUTES}
        onSelectRoute={onSelectRoute}
      />
    )
    fireEvent.click(screen.getByText('순환 셔틀'))
    expect(onSelectRoute).toHaveBeenCalledWith('r2')
  })

  it('showGrip=false이면 그립 핸들이 렌더되지 않는다', () => {
    const { container } = render(
      <MapBottomCard stationName="정왕역 정류장" primary={PRIMARY} routes={[]} showGrip={false} />
    )
    expect(container.querySelector('[aria-hidden="true"].bg-line-strong')).not.toBeInTheDocument()
  })

  it('routes가 없으면 가로 스크롤 영역을 렌더하지 않는다', () => {
    render(<MapBottomCard stationName="정왕역 정류장" primary={PRIMARY} routes={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
