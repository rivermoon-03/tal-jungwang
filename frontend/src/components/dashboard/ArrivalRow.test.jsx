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
    // formatEta(5 * 60) => "5분"
    expect(screen.getByText('5분')).toBeInTheDocument()
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

  it('minutes=null일 때 "운행 정보 없음"을 표시한다 (비실시간)', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥1"
        direction="정왕역 방면"
        minutes={null}
      />
    )
    expect(screen.getByText('운행 정보 없음')).toBeInTheDocument()
  })

  it('minutes=null + isRealtime=true이면 "실시간 준비 중"을 표시한다', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="5602"
        direction="시흥시청역 탑승"
        minutes={null}
        isRealtime
      />
    )
    expect(screen.getByText('실시간 준비 중')).toBeInTheDocument()
  })

  it('minutes=null + isRealtime=true이면 "운행 정보 없음"이 표시되지 않는다', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="5602"
        direction="시흥시청역 탑승"
        minutes={null}
        isRealtime
      />
    )
    expect(screen.queryByText('운행 정보 없음')).not.toBeInTheDocument()
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

  it('좌측 색상 테두리(border-l-*)가 없다', () => {
    const { container } = render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="시흥33"
        direction="이마트 방면"
        minutes={5}
      />
    )
    // 루트 버튼 요소에 border-l 클래스가 없어야 한다
    expect(container.firstChild.className).not.toMatch(/border-l/)
  })

  it('임박(imminentLabel)이면 "곧 도착" 텍스트를 표시한다', () => {
    render(
      <ArrivalRow
        routeColor="#2563EB"
        routeNumber="33"
        minutes={0}
        imminentLabel="곧 도착"
        isUrgent
      />
    )
    expect(screen.getByText('곧 도착')).toBeInTheDocument()
  })

  it('노선번호 "20-1"을 렌더한다', () => {
    render(
      <ArrivalRow
        routeNumber="20-1"
        minutes={8}
      />
    )
    expect(screen.getByText('20-1')).toBeInTheDocument()
  })

  it('secondMinutes(extraMinutes)가 있으면 보조 ETA를 표시한다', () => {
    render(
      <ArrivalRow
        routeNumber="시흥33"
        minutes={5}
        extraMinutes={[12]}
      />
    )
    // 두 번째 차 ETA "12분"이 표시되어야 한다
    expect(screen.getByText('12분')).toBeInTheDocument()
  })

  it('lastTrain=true이면 "막차" 칩을 표시한다', () => {
    render(
      <ArrivalRow
        routeNumber="시흥33"
        minutes={10}
        lastTrain
      />
    )
    expect(screen.getByText('막차')).toBeInTheDocument()
  })

  it('crowded>0이면 혼잡도 칩을 표시한다', () => {
    render(
      <ArrivalRow
        routeNumber="시흥33"
        minutes={5}
        crowded={3}
      />
    )
    expect(screen.getByText('혼잡')).toBeInTheDocument()
  })

  it('onClick 없이 routeNumber만 있으면 /route/bus:{routeNumber}로 pushState한다 (T6a)', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    render(
      <ArrivalRow
        routeNumber="3400"
        minutes={5}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(pushSpy).toHaveBeenCalledWith(
      { routeId: 'bus:3400' },
      '',
      '/route/bus:3400'
    )
    pushSpy.mockRestore()
  })

  it('onClick이 있으면 pushState 없이 onClick만 실행된다', () => {
    const handleClick = vi.fn()
    const pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    render(
      <ArrivalRow
        routeNumber="3400"
        minutes={5}
        onClick={handleClick}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(pushSpy).not.toHaveBeenCalled()
    pushSpy.mockRestore()
  })

  it('selectedStation이 있으면 ?stop={station} 쿼리 포함해 pushState한다 (T_stop)', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    render(
      <ArrivalRow
        routeNumber="5602"
        minutes={5}
        selectedStation="시흥시청"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(pushSpy).toHaveBeenCalledWith(
      { routeId: 'bus:5602' },
      '',
      '/route/bus:5602?stop=%EC%8B%9C%ED%9D%A5%EC%8B%9C%EC%B2%AD'
    )
    pushSpy.mockRestore()
  })

  it('selectedStation이 없으면 stop 쿼리 없이 pushState한다 (T_stop_fallback)', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    render(
      <ArrivalRow
        routeNumber="5602"
        minutes={5}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(pushSpy).toHaveBeenCalledWith(
      { routeId: 'bus:5602' },
      '',
      '/route/bus:5602'
    )
    pushSpy.mockRestore()
  })
})
