import { useMemo } from 'react'
import { Sun, Map, Navigation } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { SKY_ICON, SKY_TEXT } from '../stats/WeatherCard'
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

/**
 * HomeWeatherHero — 모바일 홈 상단 A. 날씨 상태에 따라 배경/이펙트가 변한다
 * (맑음=푸른 글로우 · 흐림=회색 · 비=빗줄기 · 눈=눈송이). 등하교 방향 pill과
 * 지도 전환 버튼을 함께 노출해 하단 B(Dashboard)로 이어지는 진입점 역할을 한다.
 */
export default function HomeWeatherHero({ onOpenMap }) {
  const { weather } = useWeather()
  const { direction } = useEffectiveDirection()

  const icon = weather?.icon ?? 'sunny'
  const mood = SKY_MOOD[icon] ?? 'sunny'
  const Icon = SKY_ICON[icon] ?? Sun
  const lightText = mood === 'rainy' // 비 배경은 중간톤 이상 어두워 라이트/다크 공통으로 흰 글자 필요

  const snowflakes = useMemo(() => SNOWFLAKES, [])

  const chipCls = lightText
    ? 'bg-black/35 border border-white/15 text-white'
    : 'bg-white/95 dark:bg-surface-3/95 border border-line dark:border-line text-ink dark:text-ink'

  return (
    <div className="whero" data-mood={mood}>
      {mood === 'sunny' && <div className="whero-glow" aria-hidden="true" />}
      {mood === 'rainy' && (
        <div className="whero-rain" aria-hidden="true"><span /><span /><span /></div>
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
    </div>
  )
}
