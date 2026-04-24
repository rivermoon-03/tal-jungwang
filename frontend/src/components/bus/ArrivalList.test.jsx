import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ArrivalList from './ArrivalList'

describe('ArrivalList ordering', () => {
  it('orders running-info routes before no-info routes', () => {
    const arrivals = [
      { route_no: '99-2', category: '하교', minutes: null },
      { route_no: '6502', category: '하교', minutes: 5 },
    ]
    const { container } = render(
      <ArrivalList arrivals={arrivals} stationId="x" stationLabel="이마트" direction="하교" />
    )
    const cards = container.querySelectorAll('[data-route]')
    expect(cards[0].getAttribute('data-route')).toBe('6502')
    expect(cards[1].getAttribute('data-route')).toBe('99-2')
  })
})
