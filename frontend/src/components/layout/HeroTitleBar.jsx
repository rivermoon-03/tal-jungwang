import { ChevronUp, ChevronDown } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useWeather } from '../../hooks/useWeather'
import { useDynamicCopy } from '../../hooks/useDynamicCopy'
import { useTheme } from '../../hooks/useTheme'
import WeatherLine from './WeatherLine'
import WarnBanner from './WarnBanner'

/**
 * HeroTitleBar — 상단 타이틀 바
 *
 * 펼침: WeatherLine + WarnBanner + 동적 카피 big/sub + ⌃ 버튼
 * 접힘: floating pill "{모드} {N분} · {날씨 이모지} {기온}°" + ⌄
 *
 * Props:
 *   nextArrival — { mode, minutes, route } | null (SummaryCard에서 전달)
 */
export default function HeroTitleBar({ nextArrival = null }) {
  const headerCollapsed = useAppStore((s) => s.headerCollapsed)
  const toggleHeader    = useAppStore((s) => s.toggleHeader)

  const { weather } = useWeather()
  const { warn, hero } = useDynamicCopy({ now: new Date(), weather, nextArrival })

  // 테마 색상 동기화
  useTheme({ headerCollapsed })

  // ── 접힘 pill ──────────────────────────────────────────────────────
  if (headerCollapsed) {
    const modeLabel =
      nextArrival?.mode === 'subway'
        ? '지하철'
        : nextArrival?.mode === 'shuttle'
          ? '셔틀'
          : nextArrival?.route ?? '버스'
    const minsLabel = nextArrival?.minutes != null ? `${nextArrival.minutes}분` : '–'
    const tempLabel = typeof weather?.currentTemp === 'number' ? `${weather.currentTemp}°` : ''
    const skyEmoji = weather?.icon === 'rainy' ? '☔' : weather?.icon === 'snowy' ? '❄️' : '🌤️'

    return (
      <div className="px-3 pt-2 pb-1 flex justify-center">
        <button
          onClick={toggleHeader}
          aria-label="타이틀 바 펼치기"
          aria-expanded={false}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark rounded-pill shadow-pill
                     text-sm font-semibold text-gray-800 dark:text-gray-100
                     active:scale-95 transition-transform"
          style={{ transition: 'transform 0.1s var(--ease-spring)' }}
        >
          <span>{modeLabel} {minsLabel}</span>
          {tempLabel && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>{skyEmoji} {tempLabel}</span>
            </>
          )}
          <ChevronDown size={16} className="text-gray-400" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // ── 펼침 ──────────────────────────────────────────────────────────
  return (
    <div
      className="bg-[#fafafa] dark:bg-bg-soft px-4 pt-3 pb-3"
      style={{ transition: 'background 0.3s var(--ease-ios)' }}
    >
      {/* 경고 배너 */}
      <WarnBanner warn={warn} />

      {/* 날씨 줄 */}
      <WeatherLine weather={weather} />

      {/* 동적 카피 */}
      <div className="flex items-start justify-between mt-1 gap-2">
        <div className="min-w-0">
          <p
            className="text-[19px] font-black leading-tight text-gray-900 dark:text-gray-50 truncate"
            style={{ fontWeight: 900 }}
          >
            {hero.big}
          </p>
          <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">
            {hero.sub}
          </p>
        </div>

        {/* 접기 버튼 */}
        <button
          onClick={toggleHeader}
          aria-label="타이틀 바 접기"
          aria-expanded={true}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0
                     active:scale-90 transition-transform"
          style={{ transition: 'transform 0.1s var(--ease-ios)' }}
        >
          <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
