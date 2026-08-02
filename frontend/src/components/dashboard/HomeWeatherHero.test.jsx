/**
 * HomeWeatherHero — 결함 #31 리디자인: 기본은 한 줄 스트립만 보이고, 펼치기 토글을
 * 누르면 기존 greeting/classic 레이아웃(인사말 진입 시퀀스·강등·툴팁·비 이펙트)이
 * 아코디언으로 나타난다. 스트립 자체(온도·하늘·바람 요약, 검색 버튼)와, 펼친 뒤의
 * 기존 동작(phase 전환·툴팁·direction 자동전환 토스트)을 함께 검증한다.
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
const mockUseEffectiveDirection = vi.fn()
vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: (...args) => mockUseEffectiveDirection(...args),
}))

// ── 스토어 모킹 — storeState를 테스트별로 재할당해 heroStyle/darkMode를 바꾼다 ──
let storeState = {
  heroStyle: 'greeting',
  darkMode: false,
  setSearchOpen: vi.fn(),
  setDirectionOverride: vi.fn(),
}
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

// ── 자동 전환 토스트 문구 헬퍼 모킹 ──
vi.mock('../../utils/directionAutoChangeToast', () => ({
  getDirectionAutoChangeMessage: vi.fn((direction) => `${direction}로 전환했어요`),
}))

// ── DirectionAutoToast 컴포넌트 모킹 — visible 상태에서만 렌더 ──
vi.mock('../../components/common/DirectionAutoToast', () => ({
  default: vi.fn(({ message, visible, onClose }) =>
    visible ? (
      <div data-testid="direction-auto-toast">
        {message}
        <button onClick={onClose}>닫기</button>
      </div>
    ) : null,
  ),
}))

// 스트립의 펼치기 토글을 눌러 아코디언 패널을 연다.
function expandPanel() {
  fireEvent.click(screen.getByLabelText('날씨 요약 펼치기'))
}

beforeEach(() => {
  vi.useFakeTimers()
  storeState = { heroStyle: 'greeting', darkMode: false, setSearchOpen: vi.fn(), setDirectionOverride: vi.fn() }
  mockUseEffectiveDirection.mockReturnValue({ direction: '등교', isOverride: false })
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

describe('HomeWeatherHero — 한 줄 스트립(기본 접힘)', () => {
  it('기본 렌더에서 온도·하늘 요약이 스트립에 보이고, 펼친 패널(글귀)은 보이지 않는다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByText(/21°/)).toBeInTheDocument()
    expect(screen.queryByTestId('hero-greeting-text')).not.toBeInTheDocument()
  })

  it('펼치기 토글에 aria-expanded=false가 있다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)
    expect(screen.getByLabelText('날씨 요약 펼치기')).toHaveAttribute('aria-expanded', 'false')
  })

  it('검색 버튼은 접힌 상태에서도 보이고, 클릭 시 setSearchOpen(true)을 호출한다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    const searchButton = screen.getByLabelText('검색')
    expect(searchButton).toBeInTheDocument()

    fireEvent.click(searchButton)
    expect(storeState.setSearchOpen).toHaveBeenCalledWith(true)
  })

  it('펼치기 토글을 누르면 aria-expanded=true로 바뀌고 글귀가 나타난다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expandPanel()

    expect(screen.getByLabelText('날씨 요약 접기')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('hero-greeting-text')).toHaveTextContent('테스트 글귀')
  })

  it('다시 누르면 접히고 글귀가 사라진다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expandPanel()
    expect(screen.getByTestId('hero-greeting-text')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('날씨 요약 접기'))
    expect(screen.queryByTestId('hero-greeting-text')).not.toBeInTheDocument()
  })
})

describe('HomeWeatherHero — 펼친 뒤 greeting 스타일(기본) 동작', () => {
  it('펼치면 글귀 텍스트가 보이고, 출처는 항상 보이는 줄로 렌더되지 않는다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()

    expect(screen.getByTestId('hero-greeting-text')).toHaveTextContent('테스트 글귀')
    expect(screen.queryByText('· 테스트 출처')).not.toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('큰 온도 토큰(text-hero-temp)은 렌더하지 않는다(온도는 축소된 whero-quote-temp)', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()

    expect(container.querySelector('.text-hero-temp')).toBeNull()
    expect(container.querySelector('.whero-quote-temp')).toBeTruthy()
  })

  it('글귀를 클릭하면 출처 툴팁이 열리고, 다시 클릭하면 닫힌다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()
    const quoteButton = screen.getByTestId('hero-greeting-text')
    expect(quoteButton.tagName).toBe('BUTTON')
    expect(quoteButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(quoteButton)
    expect(quoteButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('· 테스트 출처')

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
    expandPanel()

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
    expandPanel()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const quoteButton = screen.getByTestId('hero-greeting-text')
    expect(quoteButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(quoteButton)
    expect(quoteButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('· 테스트 출처')
  })
})

describe('HomeWeatherHero — heroStyle=classic', () => {
  it('펼치면 큰 온도(text-hero-temp) 레이아웃을 렌더하고 글귀는 렌더하지 않는다', () => {
    storeState = { heroStyle: 'classic', darkMode: false, setSearchOpen: vi.fn(), setDirectionOverride: vi.fn() }
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()

    expect(container.querySelector('.text-hero-temp')).toBeTruthy()
    expect(screen.queryByTestId('hero-greeting-text')).not.toBeInTheDocument()
  })
})

describe('HomeWeatherHero — 비 mood', () => {
  it('펼치면 3겹 원근 rain 레이어(far/mid/near)를 렌더한다', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: 15, icon: 'rainy', rainProb: 80, windSpeed: 3 },
    })
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()

    expect(container.querySelector('.whero-rain')).toBeTruthy()
    expect(container.querySelector('.whero-rain-far')).toBeTruthy()
    expect(container.querySelector('.whero-rain-mid')).toBeTruthy()
    expect(container.querySelector('.whero-rain-near')).toBeTruthy()
    expect(container.querySelector('.whero-splash')).toBeTruthy()
  })

  it('접힌 상태에서는 rain 레이어를 렌더하지 않는다(스트립만 노출)', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: 15, icon: 'rainy', rainProb: 80, windSpeed: 3 },
    })
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.whero-rain')).toBeNull()
  })
})

describe('HomeWeatherHero — 하늘과 잉크', () => {
  // 하늘 색과 그 위 글자 색은 skyPalette가 한 번에 정해 CSS 변수로 내려온다.
  // 예전에는 배경이 CSS 하드코딩, 글자는 JSX의 lightText 불리언이라 서로를
  // 몰랐고 그게 다크모드에서 대비 1.01:1 사고로 이어졌다.
  function heroEl(container) {
    return container.querySelector('.whero')
  }

  it('하늘 3스톱과 잉크를 CSS 변수로 내려보낸다', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    const style = heroEl(container).style

    for (const name of ['--whero-sky-a', '--whero-sky-b', '--whero-sky-c']) {
      expect(style.getPropertyValue(name), name).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(style.getPropertyValue('--whero-on')).toMatch(/^#[0-9a-f]{6}$/)
    expect(style.getPropertyValue('--whero-on-2')).toMatch(/^#[0-9a-f]{6}$/)
    expect(style.getPropertyValue('--whero-scrim')).toMatch(/^#(000000|ffffff)$/)
    expect(Number(style.getPropertyValue('--whero-scrim-a'))).toBeGreaterThan(0)
  })

  it('다크 테마에서는 하늘이 라이트보다 어둡고 잉크가 밝은 쪽으로 뒤집힌다', () => {
    const { container: light } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    const lightSky = heroEl(light).style.getPropertyValue('--whero-sky-b')

    storeState = { ...storeState, darkMode: true }
    const { container: dark } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    const darkStyle = heroEl(dark).style

    // 다크 하늘은 항상 더 어둡다(스톱을 정수로 비교).
    const lum = (hex) => parseInt(hex.slice(1), 16)
    expect(lum(darkStyle.getPropertyValue('--whero-sky-b'))).toBeLessThan(lum(lightSky))
    // 어두운 하늘에는 밝은 잉크가 온다.
    expect(darkStyle.getPropertyValue('--whero-scrim')).toBe('#000000')
  })

  it('스트립 칩에 죽은 클래스(dark:bg-surface-3/95)나 lightText 분기 잔재가 없다', () => {
    // 이 클래스는 Tailwind가 CSS를 만들지 않아 bg-white/95가 살아남았고,
    // 그 위에 text-ink가 얹혀 흰 글자·흰 배경(1.01:1)이 됐다.
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    const mapButton = screen.getByLabelText('지도 보기')

    expect(mapButton.className).not.toMatch(/bg-white|bg-surface-3|text-ink/)
    expect(mapButton).toHaveClass('whero-chip')
    expect(container.innerHTML).not.toMatch(/text-ink-2 dark:text-mute/)
  })

  it('하늘 위 글자는 전부 잉크 변수를 쓰는 클래스로 칠한다', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()

    expect(container.querySelectorAll('.whero-ink').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.whero-ink-2').length).toBeGreaterThan(0)
  })

  it('스크림을 한 겹 깔고, 걷어낸 오버레이(grain/breath/glow)는 렌더하지 않는다', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)
    expandPanel()

    expect(container.querySelector('.whero-scrim')).toBeTruthy()
    expect(container.querySelector('.whero-grain')).toBeNull()
    expect(container.querySelector('.whero-breath')).toBeNull()
    expect(container.querySelector('.whero-glow')).toBeNull()
  })
})

describe('HomeWeatherHero — 태양 위치', () => {
  // 배경이 낮/저녁/밤 세 칸이 아니라 태양 고도로 연속 변한다.
  const REAL_DATE = Date

  function renderAt(iso) {
    vi.setSystemTime(new REAL_DATE(`${iso}+09:00`))
    return render(<HomeWeatherHero onOpenMap={() => {}} />)
  }

  it('해 원반을 그리지 않는다(좁은 히어로에서 스티커처럼 보였다)', () => {
    const { container } = renderAt('2026-08-02T13:00:00')
    expandPanel()

    expect(container.querySelector('.whero-sun')).toBeNull()
    expect(container.querySelector('.whero-rays')).toBeNull()
  })

  it('해가 떠 있으면 낮 글로우를 얹고, 지면 걷는다', () => {
    const { container: noon } = renderAt('2026-08-02T13:00:00')
    expandPanel()
    expect(noon.querySelector('.whero-daylight')).toBeTruthy()

    const { container: night } = renderAt('2026-08-02T23:00:00')
    fireEvent.click(screen.getAllByLabelText('날씨 요약 펼치기')[0])
    expect(night.querySelector('.whero-daylight')).toBeNull()
  })

  it('낮 글로우 세기는 태양 고도를 따라간다', () => {
    const daylight = (container) =>
      Number(container.querySelector('.whero').style.getPropertyValue('--daylight'))

    const noon = daylight(renderAt('2026-08-02T12:40:00').container)
    const evening = daylight(renderAt('2026-08-02T18:40:00').container)
    const night = daylight(renderAt('2026-08-02T23:00:00').container)

    expect(noon).toBe(1)
    expect(evening).toBeGreaterThan(0)
    expect(evening).toBeLessThan(1)
    expect(night).toBe(0)
  })

  it('다크모드 한낮 하늘은 한밤보다 뚜렷하게 밝다', () => {
    storeState = { ...storeState, darkMode: true }
    const midStop = (container) =>
      parseInt(container.querySelector('.whero').style.getPropertyValue('--whero-sky-b').slice(1), 16)

    const noon = midStop(renderAt('2026-08-02T12:40:00').container)
    const night = midStop(renderAt('2026-08-02T23:00:00').container)
    expect(noon).toBeGreaterThan(night * 3)
  })

  it('한밤중에는 별과 유성을 렌더한다', () => {
    const { container } = renderAt('2026-08-02T23:00:00')
    fireEvent.click(screen.getAllByLabelText('날씨 요약 펼치기')[0])

    expect(container.querySelector('.whero-night-sky')).toBeTruthy()
    expect(container.querySelectorAll('.whero-star').length).toBeGreaterThan(0)
    expect(container.querySelector('.whero-meteor')).toBeTruthy()
  })

  it('같은 시각이라도 계절이 다르면 하늘이 다르다(시간 버킷이었다면 같았을 것)', () => {
    const { container: summer } = renderAt('2026-06-21T19:00:00')
    const summerSky = summer.querySelector('.whero').style.getPropertyValue('--whero-sky-b')

    const { container: winter } = renderAt('2025-12-21T19:00:00')
    const winterSky = winter.querySelector('.whero').style.getPropertyValue('--whero-sky-b')

    expect(summerSky).not.toBe(winterSky)
  })

  it('흐림·비·눈에는 낮 글로우가 없다(대신 그 무드의 이펙트가 온다)', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: 15, icon: 'rainy', rainProb: 80, windSpeed: 3 },
    })
    const { container } = renderAt('2026-08-02T13:00:00')
    expandPanel()
    expect(container.querySelector('.whero-daylight')).toBeNull()
    expect(container.querySelector('.whero-rain')).toBeTruthy()
  })
})

describe('HomeWeatherHero — 자동 방향 전환 토스트', () => {
  it('초기 렌더에 토스트는 보이지 않는다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.queryByTestId('direction-auto-toast')).not.toBeInTheDocument()
  })

  it('direction이 변하고 isOverride가 false면 토스트가 나타난다(접힌 상태에서도)', () => {
    const { rerender } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    // 초기: '등교', isOverride=false
    expect(screen.queryByTestId('direction-auto-toast')).not.toBeInTheDocument()

    // direction이 '하교'로 변경
    mockUseEffectiveDirection.mockReturnValue({ direction: '하교', isOverride: false })
    rerender(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByTestId('direction-auto-toast')).toHaveTextContent('하교로 전환했어요')
  })

  it('direction이 변하지만 isOverride가 true면 토스트가 나타나지 않는다', () => {
    const { rerender } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    // direction이 '하교'로 변경되지만 isOverride=true (사용자 오버라이드)
    mockUseEffectiveDirection.mockReturnValue({ direction: '하교', isOverride: true })
    rerender(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.queryByTestId('direction-auto-toast')).not.toBeInTheDocument()
  })
})
