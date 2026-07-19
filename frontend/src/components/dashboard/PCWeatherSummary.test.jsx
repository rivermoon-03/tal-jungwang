/**
 * PCWeatherSummary — PC 사이드바 날씨 위젯. 온도/상태/정왕풍/강수/글귀 렌더와
 * weather=null 로딩 스켈레톤(크래시 없음)을 검증한다. HomeWeatherHero.test.jsx와
 * 동일한 useWeather/pickGreeting 모킹 패턴을 재사용한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PCWeatherSummary from './PCWeatherSummary'

const mockUseWeather = vi.fn()
vi.mock('../../hooks/useWeather', () => ({
  useWeather: (...args) => mockUseWeather(...args),
}))

vi.mock('../../utils/heroGreeting', () => ({
  pickGreeting: vi.fn(() => ({
    text: '테스트 글귀\n둘째 줄',
    source: '테스트 출처',
    sub: null,
  })),
}))

beforeEach(() => {
  mockUseWeather.mockReturnValue({
    weather: {
      currentTemp: 21,
      icon: 'sunny',
      rainProb: 30,
      windSpeed: 3.4,
      pm10Grade: null,
    },
  })
})

describe('PCWeatherSummary', () => {
  it('온도/상태/정왕풍/강수/글귀를 렌더한다', () => {
    const { container } = render(<PCWeatherSummary />)

    expect(screen.getByText('21°')).toBeInTheDocument()
    expect(screen.getByText('맑음')).toBeInTheDocument()
    expect(container.querySelector('.pcws-meta').textContent).toContain('정왕풍 3.4m/s')
    expect(container.querySelector('.pcws-meta').textContent).toContain('살랑이는 바람')
    expect(container.querySelector('.pcws-meta').textContent).toContain('강수 30%')
    expect(screen.getByText('테스트 글귀', { exact: false })).toBeInTheDocument()
  })

  it('weather가 null이면 크래시 없이 스켈레톤을 렌더한다', () => {
    mockUseWeather.mockReturnValue({ weather: null })

    render(<PCWeatherSummary />)

    expect(screen.getByTestId('pc-weather-summary-loading')).toBeInTheDocument()
    expect(screen.queryByText('21°')).not.toBeInTheDocument()
  })
})
