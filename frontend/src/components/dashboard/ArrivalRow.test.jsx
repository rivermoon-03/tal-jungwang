import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ArrivalRow from './ArrivalRow'

describe('ArrivalRow', () => {
  it('routeNumber·direction·minutes를 렌더한다', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥33"
        direction="이마트 방면"
        minutes={5}
      />
    )
    expect(screen.getByText('시흥33')).toBeInTheDocument()
    expect(screen.getByText('이마트 방면')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('분')).toBeInTheDocument()
  })

  it('isUrgent=true일 때 data-urgent가 true', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥33"
        minutes={2}
        isUrgent
      />
    )
    expect(screen.getByRole('button').getAttribute('data-urgent')).toBe('true')
  })

  it('isUrgent=false일 때 data-urgent가 false', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥33"
        minutes={10}
      />
    )
    expect(screen.getByRole('button').getAttribute('data-urgent')).toBe('false')
  })

  it('minutes=null일 때 "운행 정보 없음"을 표시한다', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥1"
        direction="정왕역 방면"
        minutes={null}
      />
    )
    expect(screen.getByText('운행 정보 없음')).toBeInTheDocument()
    expect(screen.queryByText('분')).not.toBeInTheDocument()
  })

  it('onClick이 호출되면 콜백이 실행된다', () => {
    const handleClick = vi.fn()
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="20-1"
        minutes={7}
        onClick={handleClick}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('rightAddon이 렌더된다', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥33"
        minutes={3}
        rightAddon={<span data-testid="badge">테스트-부정확</span>}
      />
    )
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByText('테스트-부정확')).toBeInTheDocument()
  })
})
