import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

  it('긴 노선 배지("시흥33", "20-1")가 고정 폭에 눌려 줄바꿈되지 않는다', () => {
    const { container } = render(
      <MapBottomCard
        stationName="한국공학대학교"
        primary={PRIMARY}
        routes={[
          { id: 'r1', badge: '시흥33', color: '#12a594', name: '한국공대 출발', etaText: '5분' },
          { id: 'r2', badge: '20-1', color: '#1B5FAD', name: '아이파크아파트방면', etaText: '9분' },
        ]}
      />
    )
    const badges = [...container.querySelectorAll('span[aria-hidden="true"]')].filter((el) =>
      ['시흥33', '20-1'].includes(el.textContent)
    )
    expect(badges).toHaveLength(2)
    for (const badge of badges) {
      const classes = badge.className.split(' ')
      expect(classes).toContain('whitespace-nowrap')
      expect(classes).not.toContain('w-[26px]')
    }
  })

  // 회귀: 정류장(3400 하교, 시화터미널) 카드가 first(99-2)의 실시간 여부를
  // 헤더 배지 하나로 대표하면서, 아래 노선 미니카드 전체가 실시간처럼 읽혔다.
  // "실시간"은 정류장 이름 옆(헤더)이 아니라 실제로 실시간인 노선에만 붙어야 한다.
  it('실시간 배지는 정류장 헤더가 아니라 primary 노선 줄에 붙는다', () => {
    render(
      <MapBottomCard
        stationName="시화터미널"
        live
        statusLabel="임박"
        primary={{ routeName: '99-2', direction: '시화터미널 출발', etaText: '곧 도착' }}
        routes={[]}
      />
    )

    const heading = screen.getByText('시화터미널')
    expect(within(heading.parentElement).queryByText('실시간')).not.toBeInTheDocument()

    const primaryLine = screen.getByText('99-2', { exact: false }).closest('p')
    expect(within(primaryLine).getByText('실시간')).toBeInTheDocument()
  })

  it('노선별 source에 따라 실시간/시간표 배지가 노선마다 다르게 붙고, 정보가 없으면 배지가 없다', () => {
    render(
      <MapBottomCard
        stationName="시화터미널"
        primary={{}}
        routes={[
          { id: 'r1', badge: '99-2', color: '#dc2626', name: '99-2', etaText: '곧 도착', source: 'live' },
          { id: 'r2', badge: '3400', color: '#12a594', name: '3400', etaText: '9분', source: 'timetable' },
          { id: 'r3', badge: '5200', color: '#1B5FAD', name: '5200', etaText: '운행 정보 없음', source: null, tone: 'muted' },
        ]}
      />
    )

    // 실시간 배지는 99-2 카드 안에만 있다.
    const card992 = screen.getByRole('button', { name: /99-2/ })
    expect(within(card992).getByText('실시간')).toBeInTheDocument()

    // 3400 카드는 시간표 배지를 달고, 실시간 배지는 없다.
    const card3400 = screen.getByRole('button', { name: /3400/ })
    expect(within(card3400).getByText('시간표')).toBeInTheDocument()
    expect(within(card3400).queryByText('실시간')).not.toBeInTheDocument()

    // 5200(운행 정보 없음)은 실시간/시간표 배지 둘 다 없다.
    const card5200 = screen.getByRole('button', { name: /5200/ })
    expect(within(card5200).queryByText('실시간')).not.toBeInTheDocument()
    expect(within(card5200).queryByText('시간표')).not.toBeInTheDocument()
  })
})
