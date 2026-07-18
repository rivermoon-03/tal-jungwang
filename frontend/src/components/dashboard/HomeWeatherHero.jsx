import { useMemo, useState } from 'react'
import { Sun, Map, Navigation, Utensils, Wind } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { SKY_ICON, SKY_TEXT } from '../stats/WeatherCard'
import { getTimeOfDay } from '../../utils/timeOfDay'
import { describeJeongwangWind } from '../../utils/jeongwangWind'
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

  // 날씨/식당 토글 — 다른 pill(등교·자동/지도)과 같은 chip 시각언어로 통일.
  // 활성 아이콘만 채워 세그먼트 느낌. 배경 밝기에 맞춰 대비 분기.
  const toggleActiveCls = lightText ? 'bg-white text-[#1b3a6e]' : 'bg-accent-bg text-accent-ink'
  const toggleIdleCls = lightText ? 'text-white/75' : 'text-ink-2 dark:text-mute'

  // 정왕풍(定王風) — 건물풍이 센 정왕동을 재치있게 표현. 풍속 없으면 null → 줄 미표시.
  const wind = describeJeongwangWind(weather?.windSpeed ?? null)

  // 배경 밝기(lightText)에 맞춘 전경색. 식당 뷰도 날씨 배경 위라 동일 규칙을 쓴다.
  const tempColor = lightText ? 'text-white' : 'text-ink dark:text-ink'
  const skyColor  = lightText ? 'text-white/90' : 'text-ink-2 dark:text-mute'
  const metaColor = lightText ? 'text-white/80' : 'text-ink-2 dark:text-mute'

  // 정왕풍 미니 pill — 배경 대비에 맞춰 톤 조정, strong(6m/s+)이면 살짝 강조.
  const windPillCls = lightText
    ? (wind?.strong ? 'bg-white/25 text-white' : 'bg-white/15 text-white/95')
    : (wind?.strong ? 'bg-ink/10 text-ink dark:bg-white/10 dark:text-ink' : 'bg-ink/[0.06] text-ink-2 dark:bg-white/[0.07] dark:text-ink')

  // 식당 카드 — 날씨 그라디언트 위에 얹히므로 대비를 lightText로 분기(반투명 유리감).
  const venueCardCls = lightText
    ? 'bg-white/[0.14] border border-white/20'
    : 'bg-white/75 dark:bg-black/25 border border-white/50 dark:border-white/10'
  const venueNameCls = lightText ? 'text-white' : 'text-ink dark:text-ink'
  const venueMetaCls = lightText ? 'text-white/70' : 'text-ink-2 dark:text-mute'

  return (
    <div className="whero" data-mood={mood} data-time={timeOfDay}>
      {/* 날씨 이펙트 — 날씨/식당 두 뷰 모두에서 렌더해, 식당 뷰에서도 날씨 배경/분위기를 유지한다. */}
      {mood === 'sunny' && <div className="whero-glow" aria-hidden="true" />}
      {mood === 'rainy' && (
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
      {mood === 'snowy' && (
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

      {/* 하단 seam — mood 색을 대시보드 배경으로 얇게 블렌드 */}
      <div className="whero-seam" aria-hidden="true" />

      {/* 우상단 날씨↔식당 토글 — 다른 pill과 같은 chip 시각언어(라운드 카드 + 그림자). */}
      <div
        className={`absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-0.5 rounded-card p-0.5 shadow-pill ${chipCls}`}
        role="group"
        aria-label="히어로 보기 전환"
        style={{ touchAction: 'manipulation' }}
      >
        <button
          type="button"
          onClick={() => setView('weather')}
          aria-label="날씨 보기"
          aria-pressed={view === 'weather'}
          className={`flex items-center justify-center w-7 h-7 rounded-[9px] transition-colors active:scale-[0.92] ${view === 'weather' ? toggleActiveCls : toggleIdleCls}`}
        >
          <Sun size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setView('cafeteria')}
          aria-label="식당 보기"
          aria-pressed={view === 'cafeteria'}
          className={`flex items-center justify-center w-7 h-7 rounded-[9px] transition-colors active:scale-[0.92] ${view === 'cafeteria' ? toggleActiveCls : toggleIdleCls}`}
        >
          <Utensils size={14} aria-hidden="true" />
        </button>
      </div>

      {view === 'weather' ? (
        <>
          {/* 상단 바 — 좌측 세로 스택: [등교·자동] 아래 [지도]. 우측 토글은 absolute(위). */}
          <div className="relative z-10 flex flex-col items-start gap-2 px-4 pt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-card px-3 py-1.5 text-caption font-bold shadow-pill ${chipCls}`}>
              <Navigation size={12} aria-hidden="true" />
              {direction} · 자동
            </span>
            <button
              type="button"
              onClick={onOpenMap}
              aria-label="지도 보기"
              className={`inline-flex items-center gap-1.5 rounded-card px-3 py-1.5 text-caption font-bold shadow-pill min-h-[34px] active:scale-[0.94] transition-transform duration-press ease-spring ${chipCls}`}
            >
              <Map size={14} aria-hidden="true" />
              지도
            </button>
          </div>

          {/* 메인 블록 — 40% 높이를 활용해 하단 정렬. 큰 온도 + 하늘 상태 + 정왕풍.
              pb를 키워 콘텐츠가 하단 seam(34px, 배경 블렌드)에 얹히지 않게 한다. */}
          <div className="relative z-10 flex-1 flex items-end justify-between gap-3 px-4 pb-7 pt-2">
            <div className="min-w-0">
              <div className="flex items-end gap-2.5">
                <span className={`text-hero-temp tabular-nums ${tempColor}`}>
                  {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
                </span>
                <span className={`mb-1.5 text-title font-bold ${skyColor}`}>
                  {SKY_TEXT[icon] ?? ''}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {wind && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-bold ${windPillCls}`}>
                    <Wind size={12} strokeWidth={2.2} aria-hidden="true" />
                    정왕풍 {wind.value}
                    <span className="font-semibold opacity-80">· {wind.phrase}</span>
                  </span>
                )}
                {weather?.rainProb != null && weather.rainProb > 0 && (
                  <span className={`text-caption font-semibold ${metaColor}`}>
                    강수 <span className="tabular-nums">{weather.rainProb}%</span>
                  </span>
                )}
              </div>
            </div>

            <Icon
              size={64}
              strokeWidth={1.6}
              className={`shrink-0 ${lightText ? 'text-white' : 'text-ink/70 dark:text-white/90'}`}
              // 그라디언트 배경(특히 비/저녁 톤)에 아이콘이 묻히지 않게 살짝 그림자로 띄운다.
              style={{ filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.28))' }}
              aria-hidden="true"
            />
          </div>
        </>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col px-4 pb-6" style={{ paddingTop: 40 }}>
          <p className={`text-caption font-bold tracking-wide ${metaColor}`}>지금 문 연 곳</p>
          {openVenues.length === 0 ? (
            <p className={`flex-1 flex items-center justify-center text-label font-semibold ${skyColor}`}>
              지금 문 연 곳이 없어요
            </p>
          ) : (
            <ul className="mt-1.5 flex-1 flex flex-col justify-center gap-1.5">
              {openVenues.map(({ venue, status }) => (
                <li
                  key={venue.id}
                  className={`flex items-center gap-2 rounded-card px-3 py-2 backdrop-blur-sm ${venueCardCls}`}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--tj-ease)' }}
                    aria-hidden="true"
                  />
                  <span className={`flex-1 truncate text-caption font-semibold ${venueNameCls}`}>
                    {venue.name}
                  </span>
                  <span className={`shrink-0 text-caption font-medium ${venueMetaCls}`}>
                    {status.nextChange ? `~${status.nextChange}` : '24시간'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={goToCafeteria}
            className={`self-end text-caption font-bold active:scale-[0.96] transition-transform duration-press ease-spring ${lightText ? 'text-white' : 'text-accent'}`}
          >
            더보기
          </button>
        </div>
      )}
    </div>
  )
}
