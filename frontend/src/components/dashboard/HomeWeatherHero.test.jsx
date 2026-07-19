/**
 * HomeWeatherHero — heroStyle(greeting/classic) 레이아웃 분기 + 비 이펙트 렌더 테스트
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import HomeWeatherHero from './HomeWeatherHero'

// ── useWeather 모킹 — 각 describe에서 반환값을 교체 ──
const mockUseWeather = vi.fn()
vi.mock('../../hooks/useWeather', () => ({
  useWeather: (...args) => mockUseWeather(...args),
}))

// ── 방향 훅 모킹 (BusPanel.test.jsx와 동일 패턴) ──
vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: vi.fn(() => ({ direction: '등교' })),
}))

// ── 스토어 모킹 — storeState를 테스트별로 재할당해 heroStyle을 바꾼다 ──
let storeState = { heroStyle: 'greeting' }
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector(storeState),
}))

// ── 글귀 헬퍼 모킹 — 날짜에 의존하지 않는 결정적 텍스트로 고정 ──
vi.mock('../../utils/heroGreeting', () => ({
  pickGreeting: vi.fn(() => ({
    text: '테스트 글귀\n둘째 줄',
    source: '테스트 출처',
    sub: null,
  })),
}))

beforeEach(() => {
  storeState = { heroStyle: 'greeting' }
  mockUseWeather.mockReturnValue({
    weather: {
      currentTemp: 21,
      icon: 'sunny',
      rainProb: 10,
      windSpeed: 2,
    },
  })
})

describe('HomeWeatherHero — greeting 스타일(기본)', () => {
  it('pickGreeting이 고른 글귀 텍스트 + 출처를 렌더한다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByTestId('hero-greeting-text')).toHaveTextContent('테스트 글귀')
    expect(screen.getByText(/테스트 출처/)).toBeInTheDocument()
  })

  it('큰 온도 토큰(text-hero-temp)은 렌더하지 않는다(온도는 34px로 축소)', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.text-hero-temp')).toBeNull()
  })
})

describe('HomeWeatherHero — heroStyle=classic', () => {
  it('큰 온도(text-hero-temp) 레이아웃을 렌더하고 글귀는 렌더하지 않는다', () => {
    storeState = { heroStyle: 'classic' }
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.text-hero-temp')).toBeTruthy()
    expect(screen.queryByTestId('hero-greeting-text')).not.toBeInTheDocument()
  })
})

describe('HomeWeatherHero — 비 mood', () => {
  it('3겹 원근 rain 레이어(far/mid/near)를 렌더한다', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: 15, icon: 'rainy', rainProb: 80, windSpeed: 3 },
    })
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.whero-rain')).toBeTruthy()
    expect(container.querySelector('.whero-rain-far')).toBeTruthy()
    expect(container.querySelector('.whero-rain-mid')).toBeTruthy()
    expect(container.querySelector('.whero-rain-near')).toBeTruthy()
    expect(container.querySelector('.whero-splash')).toBeTruthy()
  })
})
