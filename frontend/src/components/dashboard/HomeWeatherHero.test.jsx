/**
 * HomeWeatherHero — heroStyle(greeting/classic) 레이아웃 분기 + greeting 진입
 * 시퀀스(phase: quote→weather, 글귀 강등)·출처 툴팁 + 비 이펙트 렌더 테스트
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  vi.useFakeTimers()
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

afterEach(() => {
  vi.useRealTimers()
})

describe('HomeWeatherHero — greeting 스타일(기본)', () => {
  it('초기 렌더에 글귀 텍스트가 보이고, 출처는 항상 보이는 줄로 렌더되지 않는다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByTestId('hero-greeting-text')).toHaveTextContent('테스트 글귀')
    expect(screen.queryByText('— 테스트 출처')).not.toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('큰 온도 토큰(text-hero-temp)은 렌더하지 않는다(온도는 축소된 whero-quote-temp)', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.text-hero-temp')).toBeNull()
    expect(container.querySelector('.whero-quote-temp')).toBeTruthy()
  })

  it('글귀를 클릭하면 출처 툴팁이 열리고, 다시 클릭하면 닫힌다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)
    const quoteButton = screen.getByTestId('hero-greeting-text')
    expect(quoteButton.tagName).toBe('BUTTON')
    expect(quoteButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(quoteButton)
    expect(quoteButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('— 테스트 출처')

    fireEvent.click(quoteButton)
    expect(quoteButton).toHaveAttribute('aria-expanded', 'false')

    // 퇴장 모션(160ms) 동안은 DOM에 남아 있다가 이후 사라진다.
    act(() => {
      vi.advanceTimersByTime(160)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('2초가 지나면 글귀는 사라지지 않고 강등되며(phase=weather) 온도·아이콘이 확대 클래스를 받는다', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.whero-quote-text.is-demoted')).toBeNull()
    expect(container.querySelector('.whero-quote-temp.is-grown')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // 강등 후에도 글귀는 DOM에 그대로 남아 있다(접히거나 제거되지 않는다).
    expect(screen.getByTestId('hero-greeting-text')).toHaveTextContent('테스트 글귀')
    expect(container.querySelector('.whero-quote-text.is-demoted')).toBeTruthy()
    expect(container.querySelector('.whero-quote-temp.is-grown')).toBeTruthy()
    expect(container.querySelector('.whero-quote-icon-wrap.is-grown')).toBeTruthy()
  })

  it('강등 후에도 글귀를 클릭하면 출처 툴팁이 열린다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const quoteButton = screen.getByTestId('hero-greeting-text')
    expect(quoteButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(quoteButton)
    expect(quoteButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('— 테스트 출처')
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
