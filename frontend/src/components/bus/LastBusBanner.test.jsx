import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LastBusBanner from './LastBusBanner'

function kst(hhmm) {
  return new Date(`2026-07-19T${hhmm}:00+09:00`)
}

describe('LastBusBanner', () => {
  it('막차가 30분 이내면 노선명 + 출발 시각 + 남은 분을 렌더한다', () => {
    render(
      <LastBusBanner
        entries={[{ depart_at: '22:00' }, { depart_at: '22:20', is_last: true }]}
        routeLabel="시흥33"
        now={kst('22:00')}
      />
    )
    expect(screen.getByText('시흥33 오늘 막차')).toBeInTheDocument()
    expect(screen.getByText('22:20 출발 · 20분 남음')).toBeInTheDocument()
  })

  it('routeLabel이 없으면 "오늘 막차"만 표시한다', () => {
    render(
      <LastBusBanner
        entries={[{ depart_at: '22:20', is_last: true }]}
        now={kst('22:00')}
      />
    )
    expect(screen.getByText('오늘 막차')).toBeInTheDocument()
  })

  it('막차가 30분보다 여유 있으면 null을 렌더한다(배너 미표시)', () => {
    const { container } = render(
      <LastBusBanner
        entries={[{ depart_at: '23:00', is_last: true }]}
        routeLabel="시흥33"
        now={kst('20:00')}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('막차가 이미 출발했으면 null을 렌더한다', () => {
    const { container } = render(
      <LastBusBanner
        entries={[{ depart_at: '22:00', is_last: true }]}
        routeLabel="시흥33"
        now={kst('22:30')}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('entries가 비어있으면 null을 렌더한다', () => {
    const { container } = render(
      <LastBusBanner entries={[]} routeLabel="시흥33" now={kst('22:00')} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('자정 넘김: 23:50에 00:20 막차(30분 남음)도 렌더된다', () => {
    render(
      <LastBusBanner
        entries={[{ depart_at: '22:00' }, { depart_at: '00:20', is_last: true }]}
        routeLabel="셔틀"
        now={kst('23:50')}
      />
    )
    expect(screen.getByText('셔틀 오늘 막차')).toBeInTheDocument()
    expect(screen.getByText('00:20 출발 · 30분 남음')).toBeInTheDocument()
  })

  it('compact=true면 좁은 변형 클래스가 적용된다', () => {
    render(
      <LastBusBanner
        entries={[{ depart_at: '22:20', is_last: true }]}
        now={kst('22:00')}
        compact
      />
    )
    const status = screen.getByRole('status')
    expect(status.className).toMatch(/px-3 py-2/)
  })
})
