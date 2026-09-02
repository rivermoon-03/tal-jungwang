/**
 * HomeWeatherHero — 시안 리디자인: 약 340px 고정 하늘 히어로.
 *
 * 예전엔 기본이 한 줄 스트립(44px)이고 펼치기 토글을 눌러야 온도·글귀 등 본문이
 * 나타나는 아코디언이었다. 이제 히어로는 항상 같은 구조(스트립 56px + 본문)를
 * 그린다 — 결함 #31 재발 방지는 MainShell의 "통짜 스크롤"이 맡는다(스크롤하면
 * 히어로 자체가 카드 목록과 함께 위로 사라진다). 그래서 이 테스트에는 더 이상
 * "펼치기/접기" 상호작용이 없다 — 스트립(인사말·위치 칩·뷰 토글)과 본문(온도·하늘·
 * 메타·아이콘)이 항상 함께 보이는지, 그리고 무드별 이펙트·하늘 색 계산이 여전히
 * 맞는지를 검증한다.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

describe('HomeWeatherHero — 항상 펼쳐진 스트립 + 본문(아코디언 없음)', () => {
  it('스트립의 인사말과 본문의 온도·하늘이 별도 조작 없이 함께 보인다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByTestId('hero-greeting-text')).toBeInTheDocument()
    expect(screen.getByText('21°')).toBeInTheDocument()
    expect(screen.getByText('맑음')).toBeInTheDocument()
  })

  it('"펼치기/접기" 토글이 더 이상 없다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.queryByLabelText('날씨 요약 펼치기')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('날씨 요약 접기')).not.toBeInTheDocument()
  })

  it('위치 칩(지도 진입 겸함)이 스트립에 항상 보이고, 클릭하면 onOpenMap을 호출한다', () => {
    const onOpenMap = vi.fn()
    render(<HomeWeatherHero onOpenMap={onOpenMap} />)

    const mapChip = screen.getByLabelText('지도 보기')
    expect(mapChip).toHaveTextContent('한국공학대 본캠')

    fireEvent.click(mapChip)
    expect(onOpenMap).toHaveBeenCalledTimes(1)
  })

  it('검색 버튼은 항상 보이고, 클릭 시 setSearchOpen(true)을 호출한다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    const searchButton = screen.getByLabelText('검색')
    expect(searchButton).toBeInTheDocument()

    fireEvent.click(searchButton)
    expect(storeState.setSearchOpen).toHaveBeenCalledWith(true)
  })

  // 더보기 버튼 제거 — 학식/매장 독 탭이 "학교시설" 한 탭으로 합쳐지며 독에
  // 빈 칸이 생겼고, 더보기가 다시 독의 정식 탭으로 돌아갔다(FloatingDock.jsx
  // 참고). 히어로 옵션 그룹에 같은 진입점을 또 두면 중복이라 여기서는 뺐다 —
  // "히어로 옵션" 그룹은 날씨/식당/검색 세 칸으로 되돌아간다.
  it('히어로 옵션 그룹에는 더보기 버튼이 없다(독으로 돌아감, 중복 방지)', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.queryByLabelText('더보기')).not.toBeInTheDocument()
  })

  it('큰 온도 토큰(text-hero-temp)이 항상 렌더된다', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.text-hero-temp')).toBeTruthy()
  })
})

describe('HomeWeatherHero — 스트립 인사말(heroStyle)', () => {
  it("heroStyle='greeting'이면 글귀 첫 줄을 스트립 인사말로 쓴다(둘째 줄은 잘린다)", () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByTestId('hero-greeting-text')).toHaveTextContent('테스트 글귀')
    expect(screen.getByTestId('hero-greeting-text')).not.toHaveTextContent('둘째 줄')
  })

  it("heroStyle='greeting'이면 인사말을 클릭해 출처 툴팁을 열고 닫을 수 있다", () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)
    const greetingButton = screen.getByTestId('hero-greeting-text')
    expect(greetingButton.tagName).toBe('BUTTON')
    expect(greetingButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(greetingButton)
    expect(greetingButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('· 테스트 출처')

    fireEvent.click(greetingButton)
    expect(greetingButton).toHaveAttribute('aria-expanded', 'false')

    // 퇴장 모션(160ms) 동안은 DOM에 남아 있다가 이후 사라진다.
    act(() => {
      vi.advanceTimersByTime(160)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('툴팁은 3.5초 후 자동으로 닫힌다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)
    fireEvent.click(screen.getByTestId('hero-greeting-text'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(screen.getByTestId('hero-greeting-text')).toHaveAttribute('aria-expanded', 'false')
  })

  it("heroStyle='classic'이면 고정 문구를 쓰고, 클릭해도 출처 툴팁이 없다(순수 텍스트)", () => {
    storeState = { ...storeState, heroStyle: 'classic' }
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    const greetingEl = screen.getByTestId('hero-greeting-text')
    expect(greetingEl.tagName).toBe('P')
    expect(greetingEl).toHaveTextContent('오늘의 하늘')

    fireEvent.click(greetingEl)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it("heroStyle='classic'이어도 본문의 온도·하늘 레이아웃은 greeting과 동일하다", () => {
    storeState = { ...storeState, heroStyle: 'classic' }
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.text-hero-temp')).toBeTruthy()
    expect(screen.getByText('21°')).toBeInTheDocument()
  })
})

describe('HomeWeatherHero — 결함 11: 기온 없음(current_temp: null)', () => {
  it('기온이 없으면 "--"를 text-hero-temp 크기로 채우지 않는다', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: null, icon: 'sunny', rainProb: 0, windSpeed: null },
    })
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(container.querySelector('.text-hero-temp')).not.toBeInTheDocument()
    expect(screen.queryByText('--')).not.toBeInTheDocument()
  })

  it('기온이 없어도 하늘 상태 문구는 읽을 수 있게 남는다', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: null, icon: 'sunny', rainProb: 0, windSpeed: null },
    })
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.getByText('맑음')).toBeInTheDocument()
  })
})

describe('HomeWeatherHero — 비 mood', () => {
  it('비 무드에는 3겹 원근 rain 레이어(far/mid/near)가 항상 렌더된다(아코디언 없음)', () => {
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

  it('위치 칩에 죽은 클래스(dark:bg-surface-3/95)나 lightText 분기 잔재가 없다', () => {
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

    expect(container.querySelectorAll('.whero-ink').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.whero-ink-2').length).toBeGreaterThan(0)
  })

  it('스크림을 한 겹 깔고, 걷어낸 오버레이(grain/breath/glow)는 렌더하지 않는다', () => {
    const { container } = render(<HomeWeatherHero onOpenMap={() => {}} />)

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

    expect(container.querySelector('.whero-sun')).toBeNull()
    expect(container.querySelector('.whero-rays')).toBeNull()
  })

  it('해가 떠 있으면 낮 글로우를 얹고, 지면 걷는다', () => {
    const { container: noon } = renderAt('2026-08-02T13:00:00')
    expect(noon.querySelector('.whero-daylight')).toBeTruthy()

    const { container: night } = renderAt('2026-08-02T23:00:00')
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
    expect(container.querySelector('.whero-daylight')).toBeNull()
    expect(container.querySelector('.whero-rain')).toBeTruthy()
  })
})

describe('HomeWeatherHero — 자동 방향 전환 토스트', () => {
  it('초기 렌더에 토스트는 보이지 않는다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    expect(screen.queryByTestId('direction-auto-toast')).not.toBeInTheDocument()
  })

  it('direction이 변하고 isOverride가 false면 토스트가 나타난다', () => {
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

describe('HomeWeatherHero — 스트립 뷰 토글의 44px 히트영역', () => {
  // 예전엔 날씨/식당/검색 토글이 28px(w-7 h-7)라 손가락 터치 타깃 최소치(44px) 미달이었다.
  // ui/IconButton을 -inset-2(8px)로 겹쳐 히트영역만 44px로 키우고, 보이는 배지(28px)는
  // 그대로 둔다 — 두 가지를 함께 고정한다.
  it('날씨/식당/검색 토글의 실제 클릭 가능 버튼이 44px 이상의 히트영역 클래스를 갖는다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    for (const label of ['날씨 보기', '식당 보기', '검색']) {
      const hitTarget = screen.getByLabelText(label)
      expect(hitTarget.tagName).toBe('BUTTON')
      // IconButton 정본의 44px 박스(min-h-[44px] min-w-[44px])를 그대로 쓴다.
      expect(hitTarget.className).toMatch(/min-h-\[44px\]/)
      expect(hitTarget.className).toMatch(/min-w-\[44px\]/)
    }
  })

  it('보이는 배지(아이콘 뱃지)는 여전히 28px(w-7 h-7) 시각 크기를 유지한다', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    const visibleBadge = screen.getByLabelText('날씨 보기').querySelector('.whero-toggle')
    expect(visibleBadge).toHaveClass('w-7', 'h-7')
  })

  it('식당 보기를 누르면 여전히 식당 뷰로 전환된다(뷰 전환은 항상 즉시 보인다)', () => {
    render(<HomeWeatherHero onOpenMap={() => {}} />)

    fireEvent.click(screen.getByLabelText('식당 보기'))

    expect(screen.getByLabelText('식당 보기')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('지금 문 연 곳')).toBeInTheDocument()
  })
})

// ── WalkIndexChip 팝오버가 스트립 인사말에 가려 보이던 버그(사용자 실측) —
// jsdom은 실제 페인트/stacking context를 계산하지 않으므로, .css 소스를 직접
// 읽어 원인이 된 키프레임이 되돌아오지 않는지 정규식으로 강제한다
// (WalkIndexChip.test.jsx의 토큰 규율 테스트와 같은 패턴).
describe('HomeWeatherHero — .whero-panel 진입 애니메이션이 stacking context를 남기지 않는다', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const css = fs.readFileSync(path.join(__dirname, 'HomeWeatherHero.css'), 'utf8')

  // whero-panel-in 키프레임 블록만 중괄호 균형을 맞춰 잘라낸다 — 정규식 하나로
  // 바깥 @keyframes와 안쪽 from/to 블록을 동시에 다루면 취약해진다.
  function extractBlock(source, startMarker) {
    const start = source.indexOf(startMarker)
    expect(start, `${startMarker} 블록을 찾지 못했다`).toBeGreaterThan(-1)
    let depth = 0
    let i = start
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    return source.slice(start, i + 1)
  }

  // to 키프레임만 transform: none으로 적어서는 부족했다(실측). from에 실제
  // transform이 있으면 CSS가 둘을 행렬로 보간하고, fill-mode가 both면 끝난 뒤에도
  // matrix(1,0,0,1,0,0)이 남아 stacking context가 그대로 생긴다. fill-mode가
  // both로 되돌아가면 팝오버가 다시 인사말 뒤로 숨는다.
  it('fill-mode가 backwards다 — both면 보간된 transform 행렬이 남아 stacking context가 생긴다', () => {
    const decl = css.match(/animation:\s*whero-panel-in[^;]*;/)
    expect(decl, 'whero-panel의 animation 선언을 찾지 못했다').not.toBeNull()
    expect(decl[0]).toContain('backwards')
    expect(decl[0]).not.toMatch(/\bboth\b/)
    expect(decl[0]).not.toMatch(/\bforwards\b/)
  })

  it('to 키프레임은 transform: none을 쓴다 — translateY(0)은 애니메이션이 끝난 뒤에도 남아 stacking context를 새로 만든다', () => {
    const block = extractBlock(css, '@keyframes whero-panel-in')
    expect(block).toMatch(/to\s*{\s*opacity:\s*1;\s*transform:\s*none;\s*}/)
  })

  it('to 키프레임에 translateY(0)이 다시 들어오지 않는다(원인 재발 방지)', () => {
    const block = extractBlock(css, '@keyframes whero-panel-in')
    const toBlock = block.match(/to\s*{[^}]*}/)[0]
    expect(toBlock).not.toMatch(/translateY/)
  })

  it('from 키프레임의 진입 이동(translateY(-4px))은 그대로 유지한다(시각적 회귀 방지)', () => {
    const block = extractBlock(css, '@keyframes whero-panel-in')
    expect(block).toMatch(/from\s*{\s*opacity:\s*0;\s*transform:\s*translateY\(-4px\);\s*}/)
  })
})

// 사용자 실측 — 라이트 테마 모바일에서 하늘 그라데이션이 모드 탭 바로 위에서
// 색이 딱 끊겨 보였다. .whero가 background-size: 100% 340px로 그라데이션
// 높이를 340px로 못박고 있었는데, 실제 히어로 높이는(아코디언 제거 + 기온
// 없을 때 큰 온도 자리를 접는 처리 + --tj-font-scale에 따라) 340px보다 짧을
// 수 있다. 그러면 배경 이미지가 요소 바닥에 닿기 전에 잘려, 마지막 스톱
// (sky-c)에 닿지 못한 중간색으로 끝나고 그 아래 .whero-seam과 색이 어긋난다.
describe('HomeWeatherHero — 하늘 그라데이션이 히어로 실제 높이를 따라간다(결함: 하단 잘림)', () => {
  const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'HomeWeatherHero.css'), 'utf8')

  function extractBlock(source, startMarker) {
    const start = source.indexOf(startMarker)
    expect(start, `${startMarker} 블록을 찾지 못했다`).toBeGreaterThan(-1)
    let depth = 0
    let i = start
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    return source.slice(start, i + 1)
  }

  it('.whero의 background-size가 고정 px 높이를 쓰지 않는다(340px 등)', () => {
    const block = extractBlock(css, '.whero {')
    expect(block).not.toMatch(/background-size:\s*100%\s*\d+px/)
  })

  it('.whero의 배경 그라데이션이 요소 실제 높이(100%)에 맞춰 늘어나 마지막 스톱이 항상 바닥에 닿는다', () => {
    const block = extractBlock(css, '.whero {')
    expect(block).toMatch(/background-size:\s*100%\s*100%/)
  })
})
