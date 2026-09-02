import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Sun, MapPin, Utensils, Wind, Search, MoreHorizontal } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import useAppStore from '../../stores/useAppStore'
import { SKY_ICON, SKY_TEXT } from '../stats/skyDisplay'
import { getSunAltitude, getSunPhase } from '../../utils/sunPosition'
import { getSkyPalette } from '../../utils/skyPalette'
import { describeJeongwangWind } from '../../utils/jeongwangWind'
import { pickGreeting } from '../../utils/heroGreeting'
import { getDirectionAutoChangeMessage } from '../../utils/directionAutoChangeToast'
import { ALL_VENUES } from '../../data/cafeteriaVenues'
import { isOpenNow } from '../../utils/venueOpen'
import DirectionAutoToast from '../common/DirectionAutoToast'
import IconButton from '../ui/IconButton'
import WalkIndexChip from './WalkIndexChip'
import './HomeWeatherHero.css'

// icon(5종) → mood(4종): partly_cloudy는 sunny 무드(밝은 톤)에 편입.
const SKY_MOOD = {
  sunny: 'sunny',
  partly_cloudy: 'sunny',
  cloudy: 'cloudy',
  rainy: 'rainy',
  snowy: 'snowy',
}

// '날씨 위주'(classic) 스타일의 스트립 인사말 — 감성 글귀(pickGreeting) 대신 담백한
// 고정 문구를 쓴다. 온도·하늘·바람은 이미 본문(하단)에 항상 크게 보이므로, 스트립까지
// 감성 글귀를 태우면 두 스타일의 차이가 사라진다(설정 화면의 "감성 인사" vs "날씨
// 위주" 선택이 무의미해진다).
const CLASSIC_STRIP_GREETING = '오늘의 하늘'

// 눈: 14개 중 1/3(인덱스 3의 배수)은 원경(far) — 더 작고 흐릿하게(HomeWeatherHero.css .far).
const SNOWFLAKES = Array.from({ length: 14 }, (_, i) => {
  const far = i % 3 === 0
  return {
    left: (i * 37) % 100,
    delay: (i * 0.6) % 6,
    duration: 6 + (i % 5),
    size: far ? 2 + (i % 2) : 3 + (i % 3),
    far,
  }
})

// 비 3겹 원근(far/mid/near) — 세로 그라데이션 스트릭. far일수록 옅고 느리게(HomeWeatherHero.css).
const RAIN_FAR = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 27.3) % 100,
  delay: (i * 0.23) % 1.9,
  duration: 1.7 + (i % 5) * 0.14,
}))
const RAIN_MID = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 31.7) % 100,
  delay: (i * 0.19) % 1.6,
  duration: 1.15 + (i % 4) * 0.12,
}))
const RAIN_NEAR = Array.from({ length: 9 }, (_, i) => ({
  left: (i * 41.1) % 100,
  delay: (i * 0.15) % 1.3,
  duration: 0.75 + (i % 3) * 0.09,
}))
// 빗방울이 바닥에 닿는 지점의 스플래시 링 — 화면 폭에 고르게 분산.
const SPLASHES = Array.from({ length: 6 }, (_, i) => ({
  left: (i * 16.4 + 6) % 100,
  delay: (i * 0.23) % 1.4,
}))
// 흐림: 서로 다른 속도로 좌→우 드리프트하는 구름 덩어리 4개(폭 56~110px, 속도 38~78s).
const CLOUDS = Array.from({ length: 4 }, (_, i) => ({
  top: (i * 19) % 60,
  width: 56 + (i * 79) % 55,
  duration: 38 + (i * 137) % 41,
  delay: -((i * 17) % 60),
}))
// 맑음·밤: 별 12개, 각자 다른 트윈클 주기(2~5s). 우상단은 달 자리라 비켜 둔다.
const STARS = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 53 + 7) % 78,
  top: (i * 31 + 5) % 55,
  size: 1 + (i % 4) * 0.4,
  duration: 2 + (i % 4),
  delay: (i * 0.37) % 4,
}))

/** 지금 영업 중인 매점/식당을 최대 count개까지 뽑는다 (isOpenNow 헬퍼 재사용). */
function pickOpenVenues(count) {
  return ALL_VENUES
    .map((venue) => ({ venue, status: isOpenNow(venue) }))
    .filter(({ status }) => status.open)
    .slice(0, count)
}

/** '/cafeteria'로 이동 — FloatingDock.handleNav와 동일한 pushState + popstate 패턴. */
function goToCafeteria() {
  if (window.location.pathname !== '/cafeteria') {
    window.history.pushState({}, '', '/cafeteria')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

/**
 * '/more'로 이동 — 모바일 더보기 진입점. 예전엔 App.jsx가 position:fixed
 * 오버레이 버튼으로 그렸는데, 모든 모바일 화면 위에 항상 떠서 이 히어로
 * 스트립의 뷰 토글 아이콘과 같은 자리에 겹쳐 그 아이콘을 가리는 버그가
 * 났다(사용자 실측). "히어로 옵션" 그룹은 이미 스트립 한 줄을 이루는
 * 문서 흐름 안 자리라, 더보기도 같은 자리에 아이콘 하나로 넣으면 겹침 없이
 * 상시 노출된다. 홈 화면(지금 뷰)에서만 보이지만, 하단 독의 "홈" 탭은 모든
 * 모바일 화면에 항상 떠 있어 최대 두 번(홈 → 더보기)이면 어디서든 닿는다.
 */
function goToMore() {
  if (window.location.pathname !== '/more') {
    window.history.pushState({}, '', '/more')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

/** 하늘을 다시 계산하는 주기. 태양은 5분에 약 1.25도 움직인다. */
const SKY_REFRESH_MS = 5 * 60 * 1000

/**
 * HomeWeatherHero — 모바일 홈 상단. 시안 리디자인: 약 340px 고정 하늘 히어로.
 *
 * 결함 #31(히어로가 뷰포트 45%를 영구 점유해 대시보드가 내부 스크롤에 갇힘) 재발
 * 방지는 더 이상 이 컴포넌트의 몫이 아니다 — MainShell이 히어로+대시보드를 한
 * overflow-y-auto 컨테이너에 같이 놓아("통짜 스크롤") 스크롤하면 히어로 자체가
 * 카드 목록과 함께 위로 밀려 올라가 사라진다. 그래서 여기는 접고 펼치는 아코디언
 * 없이 항상 같은 구조를 그린다:
 *   - 스트립(최소 56px): 인사말 + 위치 칩(지도 진입 겸함) + 뷰 토글 3칸(날씨/식당/검색)
 *   - 본문(하단 정렬): 온도(text-hero-temp, 60px/800) + 하늘 상태(19px) + 메타 줄
 *     (정왕풍 pill·강수확률·이동지수·미세먼지) + 우측 날씨 아이콘(52px)
 *   - 바닥 26px 이음매(seam) — 하늘을 대시보드 배경(--tj-bg)으로 얇게 블렌드
 *
 * 하늘은 하나다
 * ─────────────
 * 배경 색과 그 위의 잉크는 skyPalette.getSkyPalette()가 한 번에 정하고, 이
 * 컴포넌트는 그 결과를 CSS 변수로 흘려보내기만 한다(그라디언트 값·스크림
 * 두께·잉크 결정은 이 파일이 손대지 않는다). 시간도 낮/저녁/밤 세 칸이 아니라
 * 정왕동 좌표의 태양 고도(sunPosition.js)로 연속 보간한다 — 5분마다 다시 잰다.
 * 이펙트는 무드당 하나다(맑음=낮 글로우 또는 별·흐림=구름·비=빗줄기+스플래시·
 * 눈=눈송이).
 *
 * useAppStore.heroStyle(설정 화면의 "감성 인사" vs "날씨 위주")은 이제 스트립
 * 인사말 한 곳에만 영향을 준다 — 감성 인사는 pickGreeting()의 첫 줄(탭하면 출처
 * 툴팁), 날씨 위주는 고정 문구다. 본문(온도·하늘·메타)은 두 스타일이 항상 동일하다
 * (예전엔 greeting 스타일에서 글귀가 온도를 밀어내고 2초 뒤 자리를 바꾸는 진입/강등
 * 애니메이션이 있었지만, 이제 히어로가 고정 높이라 그 자리싸움 자체가 없어졌다).
 */
export default function HomeWeatherHero({ onOpenMap }) {
  const { weather } = useWeather()
  const { direction, isOverride } = useEffectiveDirection()
  const heroStyle = useAppStore((s) => s.heroStyle) // 'greeting'(기본) | 'classic'
  const setSearchOpen = useAppStore((s) => s.setSearchOpen)
  // useTheme이 themeMode + 시스템 설정을 종합해 스토어에 넣어 둔 실제 화면 상태.
  // 하늘 팔레트가 이 값을 받아야 다크모드에서 잉크가 어긋나지 않는다.
  const darkMode = useAppStore((s) => s.darkMode)
  const [view, setView] = useState('weather') // 'weather' | 'cafeteria' — persist 불필요, 새로고침 시 날씨로 리셋

  // 자동 방향 전환 감지 — 이전 direction을 추적하고, 자동 전환 시(isOverride=false) 토스트 표시
  const prevDirectionRef = useRef(direction)
  const [toastVisible, setToastVisible] = useState(false)
  const [previousDirection, setPreviousDirection] = useState(null)

  useEffect(() => {
    if (direction !== prevDirectionRef.current && !isOverride) {
      setPreviousDirection(prevDirectionRef.current)
      setToastVisible(true)
    }
    prevDirectionRef.current = direction
  }, [direction, isOverride])

  const icon = weather?.icon ?? 'sunny'
  const mood = SKY_MOOD[icon] ?? 'sunny'
  const Icon = SKY_ICON[icon] ?? Sun

  // ── 하늘 ────────────────────────────────────────────────────────────
  // 태양 고도를 5분마다 다시 잰다. Date는 state로 들고 있어야(렌더 중 new Date()가
  // 아니라) 리렌더 시점이 예측 가능하고, 테스트에서 가짜 타이머로 제어된다.
  const [skyClock, setSkyClock] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setSkyClock(new Date()), SKY_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const sunAltitude = getSunAltitude(skyClock)
  // 배경 색은 고도로 연속 보간하지만, "밤이냐"만 알면 되는 규칙(번개 등)은
  // 기존 세 칸 값을 그대로 쓴다.
  const timeOfDay = getSunPhase(sunAltitude)

  const sky = useMemo(
    () => getSkyPalette({ mood, altitudeDeg: sunAltitude, dark: darkMode }),
    [mood, sunAltitude, darkMode],
  )

  // 낮 글로우 세기 — 해가 지평선 위로 올라올수록 밝아지고, 25도쯤에서 최대.
  const daylight = Math.min(1, Math.max(0, sunAltitude / 25))
  const skyVars = {
    '--whero-sky-a': sky.stops[0],
    '--whero-sky-b': sky.stops[1],
    '--whero-sky-c': sky.stops[2],
    '--whero-on': sky.on,
    '--whero-on-2': sky.on2,
    '--whero-scrim': sky.scrim,
    '--whero-scrim-a': sky.scrimAlpha,
    '--daylight': daylight.toFixed(3),
  }

  const snowflakes = useMemo(() => SNOWFLAKES, [])
  const rainFar = useMemo(() => RAIN_FAR, [])
  const rainMid = useMemo(() => RAIN_MID, [])
  const rainNear = useMemo(() => RAIN_NEAR, [])
  const splashes = useMemo(() => SPLASHES, [])
  const clouds = useMemo(() => CLOUDS, [])
  const stars = useMemo(() => STARS, [])
  // view==='cafeteria'일 때만 계산 — 날씨 뷰에서는 불필요한 필터링을 하지 않는다.
  const openVenues = useMemo(
    () => (view === 'cafeteria' ? pickOpenVenues(3) : []),
    [view],
  )

  // 정왕풍(定王風) — 건물풍이 센 정왕동을 재치있게 표현. 풍속 없으면 null → 줄 미표시.
  const wind = describeJeongwangWind(weather?.windSpeed ?? null)
  // wind.strong은 describeJeongwangWind가 이미 windSpeed>=6 기준으로 판정한 값(헬퍼 재사용,
  // 임계값을 이 파일에서 다시 인라인하지 않는다) — 강풍이면 빗줄기가 기울고(--skew) 더 빠르게(0.7배) 떨어진다.
  const rainSkewStyle = wind?.strong ? { '--skew': '14deg' } : undefined
  const rainSpeedFactor = wind?.strong ? 0.7 : 1

  // 감성 인사 글귀 — heroStyle==='classic'일 땐 쓰지 않지만, 계산 자체는 가볍고
  // 하루 단위로 안정적으로 고정되므로 조건 없이 호출한다(훅 규칙과 무관한 순수
  // 유틸이라 조건부 호출 자체는 허용되지만, 매 렌더 분기를 줄이는 쪽을 택했다).
  const greeting = useMemo(
    () => pickGreeting({ mood, rainProb: weather?.rainProb, windSpeed: weather?.windSpeed, temp: weather?.currentTemp }),
    [mood, weather?.rainProb, weather?.windSpeed, weather?.currentTemp],
  )

  // 스트립 인사말 — 감성 인사는 글귀 첫 줄만(56px 한 줄 스트립엔 둘째 줄이 들어갈
  // 자리가 없다), 날씨 위주는 고정 문구.
  const stripGreetingText = heroStyle === 'greeting' ? greeting.text.split('\n')[0] : CLASSIC_STRIP_GREETING
  // 출처 툴팁은 감성 인사 + 출처가 있을 때만. UI 렌더 텍스트에 em-dash 금지 정책 —
  // 출처 접두는 "·"로.
  const tooltipContent = heroStyle === 'greeting' && greeting.source ? `· ${greeting.source}` : null
  const hasTooltip = Boolean(tooltipContent)

  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [tooltipMounted, setTooltipMounted] = useState(false) // 퇴장 모션(160ms) 동안 DOM 유지용
  const greetingWrapRef = useRef(null) // 바깥 클릭 판정 대상
  const tooltipId = useId()

  const toggleTooltip = () => {
    if (!hasTooltip) return
    const next = !tooltipOpen
    setTooltipOpen(next)
    if (next) setTooltipMounted(true)
  }

  // 툴팁 3.5초 자동 닫힘.
  useEffect(() => {
    if (!tooltipOpen) return
    const id = setTimeout(() => setTooltipOpen(false), 3500)
    return () => clearTimeout(id)
  }, [tooltipOpen])

  // 바깥 클릭으로 닫기.
  useEffect(() => {
    if (!tooltipOpen) return
    const handlePointerDown = (e) => {
      if (greetingWrapRef.current && !greetingWrapRef.current.contains(e.target)) {
        setTooltipOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [tooltipOpen])

  // 툴팁 DOM은 퇴장 모션(160ms) 동안 유지했다가 언마운트한다(여는 쪽은 toggleTooltip이 즉시 처리).
  useEffect(() => {
    if (tooltipOpen || !tooltipMounted) return
    const id = setTimeout(() => setTooltipMounted(false), 160)
    return () => clearTimeout(id)
  }, [tooltipOpen, tooltipMounted])

  // 정왕풍 pill + 강수확률 — classic/greeting 두 레이아웃이 동일하게 재사용(인라인 중복 방지).
  const windMeta = (
    <>
      {wind && (
        <span
          className={`whero-windpill ${wind.strong ? 'is-strong' : ''} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-bold`}
        >
          <Wind size={12} strokeWidth={2.2} aria-hidden="true" />
          정왕풍 {wind.value}
          <span className="font-semibold opacity-80">· {wind.phrase}</span>
        </span>
      )}
      {weather?.rainProb != null && weather.rainProb > 0 && (
        <span className="whero-ink-2 text-caption font-semibold">
          강수 <span className="tabular-nums">{weather.rainProb}%</span>
        </span>
      )}
      {/* F5 이동 지수 — 탭하면 판정 근거(기온·강수확률·미세먼지)를 펼친다 */}
      <WalkIndexChip walkIndex={weather?.walkIndex} />
      {(weather?.pm25Grade || (weather?.pm10Grade && weather.pm10Grade !== '알수없음')) && (
        <span className="whero-ink-2 text-caption font-semibold">
          미세 {weather.pm25Grade ?? weather.pm10Grade}
          {weather?.pm25 != null && <span className="tabular-nums"> {weather.pm25}</span>}
        </span>
      )}
    </>
  )

  return (
    <div className="whero" data-mood={mood} data-time={timeOfDay} style={skyVars}>
      {/* 자동 방향 전환 토스트 */}
      {previousDirection && (
        <DirectionAutoToast
          message={getDirectionAutoChangeMessage(direction)}
          previousDirection={previousDirection}
          visible={toastVisible}
          onClose={() => setToastVisible(false)}
        />
      )}

      {/* 스크림 — 하늘 위 베일. 스트립과 본문이 하나의 하늘을 공유하므로
          이 한 겹이 두 곳의 가독성을 함께 책임진다(두께는 skyPalette가 계산). */}
      <div className="whero-scrim" aria-hidden="true" />

      {/* 스트립(최소 56px) — 인사말 + 위치 칩(지도 진입 겸함) + 뷰 토글 3칸.
          아코디언 토글은 없다 — 히어로는 항상 이 구조 그대로다(스크롤로만 사라진다). */}
      <div className="whero-strip">
        <div ref={greetingWrapRef} className="relative min-w-0 flex-1">
          {hasTooltip ? (
            <button
              type="button"
              data-testid="hero-greeting-text"
              onClick={toggleTooltip}
              aria-expanded={tooltipOpen}
              aria-describedby={tooltipOpen ? tooltipId : undefined}
              className="whero-ink block w-full truncate border-0 bg-transparent p-0 text-left text-caption font-bold active:scale-[0.99] transition-transform duration-press"
            >
              {stripGreetingText}
            </button>
          ) : (
            <p data-testid="hero-greeting-text" className="whero-ink truncate text-caption font-bold">
              {stripGreetingText}
            </p>
          )}
          {tooltipMounted && (
            <div
              id={tooltipId}
              role="tooltip"
              className={`whero-quote-tooltip whero-tooltip-surface rounded-button px-3 py-1.5 text-caption shadow-sh-card ${
                tooltipOpen ? 'is-entering' : 'is-leaving'
              }`}
            >
              {tooltipContent}
            </div>
          )}
        </div>

        {/* 위치 칩 — 지도 진입을 겸한다(예전엔 별도 "지도" 칩이 있었지만, 스트립이
            "인사말 + 위치 칩 + 뷰 토글 3칸" 세 자리로 고정되며 위치 칩이 그 역할을
            이어받았다 — 지금 보고 있는 곳을 탭하면 지도가 열리는 편이 자연스럽다). */}
        <button
          type="button"
          onClick={onOpenMap}
          aria-label="지도 보기"
          className="whero-chip shrink-0 inline-flex items-center gap-1 rounded-card px-2.5 h-8 text-chip font-bold active:scale-[0.94] transition-transform duration-press ease-spring"
        >
          <MapPin size={14} aria-hidden="true" />
          한국공학대 본캠
        </button>

        <div
          className="whero-chip shrink-0 inline-flex items-center gap-0.5 rounded-card p-0.5"
          role="group"
          aria-label="히어로 옵션"
          style={{ touchAction: 'manipulation' }}
        >
          {/* 아이콘(14px)·배지(28px) 시각 크기는 그대로 두고, IconButton을 부모
              대비 -inset-2(8px)로 겹쳐 44px 히트영역만 얹는다 — 레이아웃 폭에는
              반영되지 않으므로 유리 알약(whero-chip) 자체의 크기는 변하지 않는다. */}
          <span className="relative inline-flex w-7 h-7">
            <IconButton
              type="button"
              onClick={() => setView('weather')}
              label="날씨 보기"
              aria-pressed={view === 'weather'}
              className="absolute -inset-2 !bg-transparent hover:!bg-transparent active:!bg-transparent"
            >
              <span
                className={`whero-toggle ${view === 'weather' ? 'is-on' : ''} flex items-center justify-center w-7 h-7 rounded-badge transition-transform duration-press active:scale-[0.92]`}
              >
                <Sun size={14} aria-hidden="true" />
              </span>
            </IconButton>
          </span>
          <span className="relative inline-flex w-7 h-7">
            <IconButton
              type="button"
              onClick={() => setView('cafeteria')}
              label="식당 보기"
              aria-pressed={view === 'cafeteria'}
              className="absolute -inset-2 !bg-transparent hover:!bg-transparent active:!bg-transparent"
            >
              <span
                className={`whero-toggle ${view === 'cafeteria' ? 'is-on' : ''} flex items-center justify-center w-7 h-7 rounded-badge transition-transform duration-press active:scale-[0.92]`}
              >
                <Utensils size={14} aria-hidden="true" />
              </span>
            </IconButton>
          </span>
          <span className="relative inline-flex w-7 h-7">
            <IconButton
              type="button"
              onClick={() => setSearchOpen?.(true)}
              label="검색"
              className="absolute -inset-2 !bg-transparent hover:!bg-transparent active:!bg-transparent"
            >
              <span className="whero-toggle flex items-center justify-center w-7 h-7 rounded-badge transition-transform duration-press active:scale-[0.92]">
                <Search size={14} aria-hidden="true" />
              </span>
            </IconButton>
          </span>
          {/* 더보기 — App.jsx의 옛 고정 오버레이 버튼을 여기로 옮겼다(goToMore
              주석 참고). 다른 세 아이콘과 같은 문서 흐름 안 자리라 무엇도
              가리지 않는다. */}
          <span className="relative inline-flex w-7 h-7">
            <IconButton
              type="button"
              onClick={goToMore}
              label="더보기"
              className="absolute -inset-2 !bg-transparent hover:!bg-transparent active:!bg-transparent"
            >
              <span className="whero-toggle flex items-center justify-center w-7 h-7 rounded-badge transition-transform duration-press active:scale-[0.92]">
                <MoreHorizontal size={14} aria-hidden="true" />
              </span>
            </IconButton>
          </span>
        </div>
      </div>

      {/* 본문 — 항상 펼쳐진다(아코디언 없음). 결함 #31 재발 방지는 MainShell의
          통짜 스크롤이 맡는다. */}
      <div className="whero-panel">
      {/* 날씨 이펙트 — 날씨/식당 두 뷰 모두에서 렌더해, 식당 뷰에서도 날씨 배경/분위기를 유지한다.
          무드당 한 겹씩만 얹는다. */}
      {mood === 'sunny' && sunAltitude > 0 && <div className="whero-daylight" aria-hidden="true" />}
      {mood === 'sunny' && timeOfDay === 'night' && (
        <div className="whero-night-sky" aria-hidden="true">
          {stars.map((s, i) => (
            <span
              key={i}
              className="whero-star"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size, height: s.size,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
          <span className="whero-meteor" />
        </div>
      )}
      {mood === 'cloudy' && (
        <div className="whero-clouds" aria-hidden="true">
          {clouds.map((c, i) => (
            <span
              key={i}
              style={{
                top: `${c.top}%`,
                width: `${c.width}px`,
                animationDuration: `${c.duration}s`,
                animationDelay: `${c.delay}s`,
              }}
            />
          ))}
        </div>
      )}
      {mood === 'rainy' && (
        <div className="whero-rain" aria-hidden="true" style={rainSkewStyle}>
          <div className="whero-rain-far">
            {rainFar.map((d, i) => (
              <span
                key={i}
                style={{
                  left: `${d.left}%`,
                  animationDelay: `${d.delay}s`,
                  animationDuration: `${d.duration * rainSpeedFactor}s`,
                }}
              />
            ))}
          </div>
          <div className="whero-rain-mid">
            {rainMid.map((d, i) => (
              <span
                key={i}
                style={{
                  left: `${d.left}%`,
                  animationDelay: `${d.delay}s`,
                  animationDuration: `${d.duration * rainSpeedFactor}s`,
                }}
              />
            ))}
          </div>
          <div className="whero-rain-near">
            {rainNear.map((d, i) => (
              <span
                key={i}
                style={{
                  left: `${d.left}%`,
                  animationDelay: `${d.delay}s`,
                  animationDuration: `${d.duration * rainSpeedFactor}s`,
                }}
              />
            ))}
          </div>
          <div className="whero-splash">
            {splashes.map((s, i) => (
              <span key={i} style={{ left: `${s.left}%`, animationDelay: `${s.delay}s` }} />
            ))}
          </div>
        </div>
      )}
      {mood === 'rainy' && timeOfDay === 'night' && <div className="whero-lightning" aria-hidden="true" />}
      {mood === 'snowy' && (
        <div className="whero-snow" aria-hidden="true">
          {snowflakes.map((f, i) => (
            <span
              key={i}
              className={f.far ? 'far' : undefined}
              style={{
                left: `${f.left}%`,
                width: f.size, height: f.size,
                animationDelay: `${f.delay}s`,
                animationDuration: `${f.duration}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* 하단 seam — 하늘을 대시보드 배경으로 얇게 블렌드(26px) */}
      <div className="whero-seam" aria-hidden="true" />

      {view === 'weather' ? (
        // 본문 — 온도(60px/800) + 하늘 상태(19px), 그 아래 메타 줄, 우측 날씨 아이콘(52px).
        // heroStyle과 무관하게 항상 같은 레이아웃이다(스타일 차이는 스트립 인사말에만 있다).
        <div className="relative z-10 flex-1 flex items-end justify-between gap-3 px-4 pb-7 pt-2">
          <div className="min-w-0">
            {weather?.currentTemp != null ? (
              <div className="flex items-end gap-2.5">
                <span className="whero-ink text-hero-temp tabular-nums">
                  {weather.currentTemp}°
                </span>
                <span className="whero-ink-2 mb-1.5 text-title-sm font-bold">
                  {SKY_TEXT[icon] ?? ''}
                </span>
              </div>
            ) : (
              // 기온이 없을 때(백엔드가 current_temp: null을 줄 때) — 예전엔 이 자리를
              // "--"로 text-hero-temp(60px) 크기 그대로 채웠다. 어두운 히어로 배경 위에서
              // 그 "--"가 글자가 아니라 무언가 가려진 흰 블록처럼 보였다(실측 결함). 큰
              // 자리를 접고, 하늘 상태 문구만 사람이 읽을 수 있는 크기로 남긴다.
              <div className="flex items-end gap-2.5">
                <span className="whero-ink text-eta font-extrabold">
                  {SKY_TEXT[icon] ?? '날씨 정보 없음'}
                </span>
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {windMeta}
            </div>
          </div>

          <Icon
            size={52}
            strokeWidth={1.6}
            className="whero-ink shrink-0"
            // 하늘 위에 아이콘이 묻히지 않게 스크림과 같은 극성의 그림자로 띄운다.
            style={{ filter: 'drop-shadow(0 2px 7px rgb(from var(--whero-scrim) r g b / 0.35))' }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col px-4 pb-6" style={{ paddingTop: 40 }}>
          <p className="whero-ink-2 text-caption font-bold tracking-wide">지금 문 연 곳</p>
          {openVenues.length === 0 ? (
            <p className="whero-ink-2 flex-1 flex items-center justify-center text-label font-semibold">
              지금 문 연 곳이 없어요
            </p>
          ) : (
            <ul className="mt-1.5 flex-1 flex flex-col justify-center gap-1.5">
              {openVenues.map(({ venue, status }) => (
                <li
                  key={venue.id}
                  className="whero-venue flex items-center gap-2 rounded-card px-3 py-2 backdrop-blur-sm"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--tj-ease)' }}
                    aria-hidden="true"
                  />
                  <span className="whero-ink flex-1 truncate text-caption font-semibold">
                    {venue.name}
                  </span>
                  <span className="whero-ink-2 shrink-0 text-caption font-medium">
                    {status.nextChange ? `~${status.nextChange}` : '24시간'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={goToCafeteria}
            className="whero-ink self-end text-caption font-bold active:scale-[0.96] transition-transform duration-press ease-spring"
          >
            더보기
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
