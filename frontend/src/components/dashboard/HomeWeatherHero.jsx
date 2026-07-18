import { useMemo, useState } from 'react'
import { Sun, Map, Navigation, Utensils } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { SKY_ICON, SKY_TEXT } from '../stats/WeatherCard'
import { getTimeOfDay } from '../../utils/timeOfDay'
import { ALL_VENUES } from '../../data/cafeteriaVenues'
import { isOpenNow } from '../../utils/venueOpen'
import './HomeWeatherHero.css'

// icon(5종) → mood(4종): partly_cloudy는 sunny 무드(밝은 톤)에 편입.
const SKY_MOOD = {
  sunny: 'sunny',
  partly_cloudy: 'sunny',
  cloudy: 'cloudy',
  rainy: 'rainy',
  snowy: 'snowy',
}

const SNOWFLAKES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 0.6) % 6,
  duration: 6 + (i % 5),
  size: 3 + (i % 3),
}))

// 시안 v4(미니멀 물방울, 사용자 확정) — 눈 이펙트와 동일한 개별 span 패턴.
const RAINDROPS = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 21.1) % 100,
  delay: (i * 0.17) % 1.6,
  duration: 0.7 + (i % 4) * 0.1,
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
 * HomeWeatherHero — 모바일 홈 상단 A. 날씨 상태 + 시간대(낮/저녁/밤)에 따라
 * 배경/이펙트가 변한다(맑음=푸른 글로우 · 흐림=회색 · 비=빗줄기 · 눈=눈송이,
 * 맑음·흐림은 저녁엔 노을/보랏빛, 밤엔 남색/청회색으로 톤이 어두워진다).
 * 등하교 방향 pill과 지도 전환 버튼을 함께 노출해 하단 B(Dashboard)로 이어지는
 * 진입점 역할을 한다. 우상단 아이콘 토글로 같은 자리에서 "지금 영업 중인
 * 매점/식당" 미니 뷰로 전환할 수 있다(세션 동안만 유지되는 로컬 state).
 */
export default function HomeWeatherHero({ onOpenMap }) {
  const { weather } = useWeather()
  const { direction } = useEffectiveDirection()
  const [view, setView] = useState('weather') // 'weather' | 'cafeteria' — persist 불필요, 새로고침 시 날씨로 리셋

  const icon = weather?.icon ?? 'sunny'
  const mood = SKY_MOOD[icon] ?? 'sunny'
  const Icon = SKY_ICON[icon] ?? Sun

  // 시간대는 KST 기준(getTimeOfDay가 Intl.DateTimeFormat('Asia/Seoul') 패턴을 씀).
  // 렌더마다 새로 계산 — 히어로가 마운트된 채 시간대가 바뀌어도 다음 렌더에 반영.
  const timeOfDay = getTimeOfDay()
  const timeShifted = (mood === 'sunny' || mood === 'cloudy') && timeOfDay !== 'day'
  // 비 배경은 항상 어둡고, 맑음/흐림은 저녁·밤에 배경이 어두워질 때만 흰 글자로 전환.
  // 눈(snowy)은 시간대 영향을 받지 않는 파스텔 배경을 유지하므로 제외(대비 유지).
  const lightText = mood === 'rainy' || timeShifted

  const snowflakes = useMemo(() => SNOWFLAKES, [])
  const raindrops = useMemo(() => RAINDROPS, [])
  // view==='cafeteria'일 때만 계산 — 날씨 뷰에서는 불필요한 필터링을 하지 않는다.
  const openVenues = useMemo(
    () => (view === 'cafeteria' ? pickOpenVenues(3) : []),
    [view],
  )

  const chipCls = lightText
    ? 'bg-black/35 border border-white/15 text-white'
    : 'bg-white/95 dark:bg-surface-3/95 border border-line dark:border-line text-ink dark:text-ink'

  // 식당 뷰는 그라디언트 히어로 대신 카드형 배경(surface+line)으로 전환한다.
  // 인라인 style로 덮어써 mood/time 조합 CSS 셀렉터의 명시도 경쟁을 피한다.
  const cafeteriaStyle = view === 'cafeteria'
    ? { background: 'var(--tj-surface)', border: '1px solid var(--tj-line)' }
    : undefined

  return (
    <div className="whero" data-mood={mood} data-time={timeOfDay} style={cafeteriaStyle}>
      {view === 'weather' && mood === 'sunny' && <div className="whero-glow" aria-hidden="true" />}
      {view === 'weather' && mood === 'rainy' && (
        <div className="whero-rain" aria-hidden="true">
          {raindrops.map((d, i) => (
            <span
              key={i}
              style={{
                left: `${d.left}%`,
                animationDelay: `${d.delay}s`,
                animationDuration: `${d.duration}s`,
              }}
            />
          ))}
        </div>
      )}
      {view === 'weather' && mood === 'snowy' && (
        <div className="whero-snow" aria-hidden="true">
          {snowflakes.map((f, i) => (
            <span
              key={i}
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

      {/* 우상단 아이콘 전용 토글 — 날씨 ↔ 식당. 라벨 없이 아이콘만(공간 절약). */}
      <div className="whero-toggle" role="group" aria-label="히어로 보기 전환">
        <button
          type="button"
          onClick={() => setView('weather')}
          aria-label="날씨 보기"
          aria-pressed={view === 'weather'}
          className={`whero-toggle-btn ${view === 'weather' ? 'is-active' : ''}`}
        >
          <Sun size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setView('cafeteria')}
          aria-label="식당 보기"
          aria-pressed={view === 'cafeteria'}
          className={`whero-toggle-btn ${view === 'cafeteria' ? 'is-active' : ''}`}
        >
          <Utensils size={13} aria-hidden="true" />
        </button>
      </div>

      {view === 'weather' ? (
        <>
          <div className="relative z-10 flex items-center justify-between px-4 pt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-card px-3 py-1.5 text-caption font-bold shadow-pill ${chipCls}`}>
              <Navigation size={12} aria-hidden="true" />
              {direction} · 자동
            </span>
            <button
              type="button"
              onClick={onOpenMap}
              aria-label="지도 보기"
              className={`flex items-center gap-1.5 rounded-card px-3 py-2 text-[13px] font-bold shadow-pill min-h-[36px] active:scale-[0.94] transition-transform duration-press ease-spring ${chipCls}`}
            >
              <Map size={15} aria-hidden="true" />
              지도
            </button>
          </div>

          <div className="relative z-10 flex items-end justify-between px-4 pb-4 pt-2">
            <div className="flex items-end gap-2.5">
              <span
                className={`text-eta-xl font-bold tabular-nums leading-none tracking-[-0.04em] ${lightText ? 'text-white' : 'text-ink dark:text-ink'}`}
              >
                {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
              </span>
              <span className={`mb-0.5 text-label font-semibold ${lightText ? 'text-white/90' : 'text-ink-2 dark:text-mute'}`}>
                {SKY_TEXT[icon] ?? ''}
              </span>
            </div>
            <Icon
              size={38}
              strokeWidth={1.5}
              className={lightText ? 'text-white/85' : 'text-ink/70 dark:text-white/80'}
              aria-hidden="true"
            />
          </div>
        </>
      ) : (
        <div
          className="relative z-10 flex h-full flex-col gap-2 px-4 pb-3"
          style={{ paddingTop: 40 }}
        >
          {openVenues.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-label font-semibold text-ink-2 dark:text-mute">
              지금 문 연 곳이 없어요
            </p>
          ) : (
            <ul className="flex-1 flex flex-col justify-center gap-2">
              {openVenues.map(({ venue, status }) => (
                <li
                  key={venue.id}
                  className="flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-1.5"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--tj-ease)' }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-caption font-semibold text-ink">
                    {venue.name}
                  </span>
                  <span className="shrink-0 text-caption font-medium text-ink-2 dark:text-mute">
                    {status.nextChange ? `~${status.nextChange}` : '24시간'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={goToCafeteria}
            className="self-end text-caption font-bold text-accent active:scale-[0.96] transition-transform duration-press ease-spring"
          >
            더보기
          </button>
        </div>
      )}
    </div>
  )
}
