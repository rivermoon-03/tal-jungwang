import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Sun, Map, Navigation, Utensils, Wind, Search, ChevronDown } from 'lucide-react'
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

/** 하늘을 다시 계산하는 주기. 태양은 5분에 약 1.25도 움직인다. */
const SKY_REFRESH_MS = 5 * 60 * 1000

/**
 * HomeWeatherHero — 모바일 홈 상단 A. 결함 #31 리디자인: 기본은 "한 줄 스트립"만
 * 차지한다("32° 맑음 · 바람 2.6m/s" + 펼치기 토글) — 예전처럼 뷰포트의 45%를
 * 영구 점유해 하단 Dashboard가 내부 스크롤에 갇히던 문제를 없앤다. 스트립을
 * 탭하면 아코디언으로 펼쳐져 인사말/예보 상세가 나타난다.
 *
 * 하늘은 하나다
 * ─────────────
 * 배경 색과 그 위의 잉크는 skyPalette.getSkyPalette()가 한 번에 정하고, 이
 * 컴포넌트는 그 결과를 CSS 변수로 흘려보내기만 한다. 예전에는 배경이 CSS의
 * 무드×시간대 하드코딩이고 글자 색은 여기 `lightText` 불리언이라 서로를 몰랐다
 * (다크 맑음·낮에서 남색 배경 위에 회색 글자가 얹혀 2.2:1까지 떨어졌고, 흰
 * 알약 위 흰 글자는 1.01:1이었다). 이제 두 판단이 한 함수에서 나오고,
 * skyPalette.test.js가 무드×고도×테마 전 조합의 대비를 실제로 계산해 막는다.
 *
 * 시간도 세 칸이 아니다
 * ───────────────────
 * 낮/저녁/밤 버킷 대신 정왕동 좌표의 **태양 고도**(sunPosition.js)로 하늘을
 * 연속 보간한다. 12월 6시와 6월 6시가 다른 하늘이 된다. 5분마다 다시 계산한다.
 * 해 원반을 실제 위치에 띄우는 것도 해 봤지만 좁은 히어로 안에서는 어디에 두든
 * 붙여 놓은 스티커처럼 보여서 걷어냈다 — 시간의 흐름은 배경 색이 말한다.
 *
 * 이펙트는 무드당 하나다(맑음=낮 글로우 또는 별·흐림=구름·비=빗줄기+스플래시·
 * 눈=눈송이). 예전의 glow/breath/grain 세 겹은 서로 싸워 하늘을 회색으로
 * 씻어내기만 해서 걷어냈다.
 *
 * useAppStore.heroStyle에 따라 펼친 메인 블록이 두 가지로 갈린다:
 *  - 'classic': 큰 온도(60px) 중심 레이아웃.
 *  - 'greeting'(기본): 온도 위에 pickGreeting()이 고른 감성 글귀를 얹고,
 *    온도는 34px로 축소했다가 2초 뒤 확대한다.
 * 지도 전환 버튼·날씨/식당 토글·검색 진입은 모두 스트립 행 우측에 항상 노출한다.
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
  // 아코디언 펼침 여부 — 기본 접힘(스트립만 노출). persist 불필요(세션 로컬, 새로고침 시 리셋).
  const [expanded, setExpanded] = useState(false)
  // 날씨/식당 토글 클릭 시: 뷰 전환 + 결과를 보여주기 위해 패널을 함께 펼친다.
  function selectView(next) {
    setView(next)
    setExpanded(true)
  }

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

  // greeting 스타일 글귀 — mood·풍속·기온이 바뀔 때만 다시 고른다(하루 단위로 안정적으로 고정됨).
  const greeting = useMemo(
    () => pickGreeting({ mood, rainProb: weather?.rainProb, windSpeed: weather?.windSpeed, temp: weather?.currentTemp }),
    [mood, weather?.rainProb, weather?.windSpeed, weather?.currentTemp],
  )

  // ── greeting 진입 시퀀스(phase) + 출처 툴팁 ──────────────────────────────
  // phase: 'quote'(글귀 표시) → 'weather'(글귀는 남되 작게 강등되고 온도가 주인공을 넘겨받음).
  // heroStyle==='classic'이면 미사용.
  const [phase, setPhase] = useState('quote')
  const [quoteEntered, setQuoteEntered] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [tooltipMounted, setTooltipMounted] = useState(false) // 퇴장 모션(160ms) 동안 DOM 유지용
  const tooltipOpenRef = useRef(false) // phase 타이머 콜백이 최신 tooltipOpen을 읽기 위한 ref(클로저 stale 방지)
  const quoteWrapRef = useRef(null) // 바깥 클릭 판정 대상
  const tooltipId = useId()

  // UI 렌더 텍스트에 em-dash 금지 정책 — 출처 접두는 "·"로.
  const tooltipContent = greeting.source ? `· ${greeting.source}` : (greeting.sub || null)
  const hasTooltip = Boolean(tooltipContent)

  // 열기는 이벤트 핸들러에서 즉시 동기 처리(effect의 setState 남용을 피한다).
  // 닫기(퇴장 모션 유지)는 아래 effect가 타이머 콜백에서 비동기로 처리한다.
  const toggleTooltip = () => {
    if (!hasTooltip) return
    const next = !tooltipOpen
    setTooltipOpen(next)
    if (next) setTooltipMounted(true)
  }

  // 진입 모션 트리거 — 마운트 직후 한 틱 뒤 'is-visible'로 바꿔야 opacity/blur/translateY
  // 트랜지션이 실제로 재생된다(초기 렌더 값 그대로 두면 트랜지션이 발화하지 않는다).
  useEffect(() => {
    if (heroStyle !== 'greeting') return
    const id = setTimeout(() => setQuoteEntered(true), 0)
    return () => clearTimeout(id)
  }, [heroStyle])

  // ref는 effect 밖(render)에서 직접 못 건드리므로(react-hooks/refs), effect에서 동기화한다.
  useEffect(() => {
    tooltipOpenRef.current = tooltipOpen
  }, [tooltipOpen])

  // 2초 후 글귀 강등 + 온도 확대. 툴팁을 읽는 중(열려 있음)이면 그 시점부터 2초씩 다시 연장한다.
  useEffect(() => {
    if (heroStyle !== 'greeting') return
    let id
    const schedule = () => {
      id = setTimeout(() => {
        if (tooltipOpenRef.current) {
          schedule()
        } else {
          setPhase('weather')
        }
      }, 2000)
    }
    schedule()
    return () => clearTimeout(id)
  }, [heroStyle])

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
      if (quoteWrapRef.current && !quoteWrapRef.current.contains(e.target)) {
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

  // 강등(phase='weather') 후에도 줄바꿈은 그대로 유지한다. br을 공백으로 합치면 줄 수가
  // 바뀌어 강등 트랜지션(font-size만 부드럽게 줄어드는 연출) 도중 텍스트가 다시 흐르며
  // 레이아웃이 한 번 더 튀는 부작용이 생긴다 — 줄 구조를 고정해야 순수하게 크기만 작아진다.
  const greetingLines = greeting.text.split('\n').map((line, i, arr) => (
    <Fragment key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </Fragment>
  ))

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

      {/* 스크림 — 하늘 위 베일. 스트립과 패널이 하나의 하늘을 공유하므로
          이 한 겹이 두 곳의 가독성을 함께 책임진다(두께는 skyPalette가 계산). */}
      <div className="whero-scrim" aria-hidden="true" />

      {/* 한 줄 스트립 — 결함 #31: 항상 이 높이만 차지. 왼쪽은 펼치기 토글,
          오른쪽은 날씨/식당/검색 아이콘(항상 노출 — 검색은 명세상 필수 유지). */}
      <div className="whero-strip">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? '날씨 요약 접기' : '날씨 요약 펼치기'}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left active:scale-[0.99] transition-transform duration-press"
        >
          <span className="whero-ink text-caption font-bold whitespace-nowrap truncate">
            {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'} {SKY_TEXT[icon] ?? ''}
          </span>
          {wind && (
            <span className="whero-ink-2 text-caption font-medium whitespace-nowrap truncate">
              · 바람 {wind.value}
            </span>
          )}
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={`whero-ink-2 shrink-0 transition-transform duration-base ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* 지도 진입 — 접힘 상태에서도 항상 노출(핵심 액션을 아코디언 뒤에 숨기지 않는다). */}
        <button
          type="button"
          onClick={onOpenMap}
          aria-label="지도 보기"
          className="whero-chip shrink-0 inline-flex items-center gap-1 rounded-card px-2.5 h-8 text-[12px] font-bold active:scale-[0.94] transition-transform duration-press ease-spring"
        >
          <Map size={14} aria-hidden="true" />
          지도
        </button>

        <div
          className="whero-chip shrink-0 inline-flex items-center gap-0.5 rounded-card p-0.5"
          role="group"
          aria-label="히어로 옵션"
          style={{ touchAction: 'manipulation' }}
        >
          <button
            type="button"
            onClick={() => selectView('weather')}
            aria-label="날씨 보기"
            aria-pressed={view === 'weather'}
            className={`whero-toggle ${view === 'weather' ? 'is-on' : ''} flex items-center justify-center w-7 h-7 rounded-badge active:scale-[0.92]`}
          >
            <Sun size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => selectView('cafeteria')}
            aria-label="식당 보기"
            aria-pressed={view === 'cafeteria'}
            className={`whero-toggle ${view === 'cafeteria' ? 'is-on' : ''} flex items-center justify-center w-7 h-7 rounded-badge active:scale-[0.92]`}
          >
            <Utensils size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen?.(true)}
            aria-label="검색"
            className="whero-toggle flex items-center justify-center w-7 h-7 rounded-badge active:scale-[0.92]"
          >
            <Search size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 아코디언 패널 — 펼쳤을 때만 마운트. 기존 인사말/예보 상세 + 날씨 이펙트가 여기 담긴다. */}
      {expanded && (
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
      {/* 하단 seam — 하늘을 대시보드 배경으로 얇게 블렌드 */}
      <div className="whero-seam" aria-hidden="true" />

      {view === 'weather' ? (
        <>
          {/* 지도 버튼은 스트립 행으로 이동(항상 노출) — 패널 상단 바는 제거. */}
          {/* 메인 블록 — heroStyle에 따라 두 레이아웃으로 갈린다.
              pb를 키워 콘텐츠가 하단 seam(34px, 배경 블렌드)에 얹히지 않게 한다. */}
          {heroStyle === 'classic' ? (
            <div className="relative z-10 flex-1 flex items-end justify-between gap-3 px-4 pb-7 pt-2">
              <div className="min-w-0">
                <div className="flex items-end gap-2.5">
                  <span className="whero-ink text-hero-temp tabular-nums">
                    {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
                  </span>
                  <span className="whero-ink-2 mb-1.5 text-title font-bold">
                    {SKY_TEXT[icon] ?? ''}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {windMeta}
                </div>
              </div>

              <Icon
                size={64}
                strokeWidth={1.6}
                className="whero-ink shrink-0"
                // 하늘 위에 아이콘이 묻히지 않게 스크림과 같은 극성의 그림자로 띄운다.
                style={{ filter: 'drop-shadow(0 2px 7px rgb(from var(--whero-scrim) r g b / 0.35))' }}
                aria-hidden="true"
              />
            </div>
          ) : (
            <div className="relative z-10 flex-1 flex flex-col justify-end gap-3 px-4 pb-7 pt-1">
              {/* 인사 글귀 — 하루 단위로 안정적으로 고정된다(heroGreeting.pickGreeting).
                  마운트 900ms 진입 모션 → 2초 뒤 사라지거나 접히지 않고 그 자리에서 작게
                  강등(demote)된다(whero-quote-text.is-demoted, 21px/800 → 13px/500).
                  동시에 아래 온도 행이 확대되며 시각적 주인공을 이어받는다(phase).
                  prefers-reduced-motion은 index.css 전역 규칙(transition/animation ≈0ms)이
                  이미 처리하므로 여기서 별도 분기를 두지 않는다. */}
              <div
                ref={quoteWrapRef}
                className={`min-w-0 whero-quote-content ${quoteEntered ? 'is-visible' : ''}`}
              >
                {hasTooltip ? (
                  <button
                    type="button"
                    data-testid="hero-greeting-text"
                    onClick={toggleTooltip}
                    aria-expanded={tooltipOpen}
                    aria-describedby={tooltipOpen ? tooltipId : undefined}
                    className={`whero-quote-text block w-full cursor-pointer border-0 bg-transparent p-0 text-left [text-wrap:balance] ${
                      phase === 'weather' ? 'is-demoted' : ''
                    }`}
                  >
                    {greetingLines}
                  </button>
                ) : (
                  <p
                    data-testid="hero-greeting-text"
                    className={`whero-quote-text [text-wrap:balance] ${
                      phase === 'weather' ? 'is-demoted' : ''
                    }`}
                  >
                    {greetingLines}
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

              {/* 하단 행 — 온도 + 하늘 텍스트 + 정왕풍 pill + 아이콘. phase='weather'로 넘어가면
                  위 글귀는 강등되고, 온도(34→56px)·하늘 텍스트(14→18px)·아이콘(scale)이 확대된다. */}
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-end gap-2">
                    <span
                      className={`whero-quote-temp whero-ink font-extrabold leading-none tabular-nums ${
                        phase === 'weather' ? 'is-grown' : ''
                      }`}
                    >
                      {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
                    </span>
                    <span
                      className={`whero-quote-sky whero-ink-2 mb-0.5 font-bold ${phase === 'weather' ? 'is-grown' : ''}`}
                    >
                      {SKY_TEXT[icon] ?? ''}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {windMeta}
                  </div>
                </div>

                <span className={`whero-quote-icon-wrap ${phase === 'weather' ? 'is-grown' : ''}`}>
                  <Icon
                    size={32}
                    strokeWidth={1.6}
                    className="whero-ink shrink-0"
                    style={{ filter: 'drop-shadow(0 2px 7px rgb(from var(--whero-scrim) r g b / 0.35))' }}
                    aria-hidden="true"
                  />
                </span>
              </div>
            </div>
          )}
        </>
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
      )}
    </div>
  )
}
