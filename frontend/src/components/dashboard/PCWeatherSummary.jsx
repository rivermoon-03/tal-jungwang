import { useMemo } from 'react'
import { Sun } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import { SKY_ICON, SKY_TEXT } from '../stats/WeatherCard'
import { pickGreeting } from '../../utils/heroGreeting'
import { describeJeongwangWind } from '../../utils/jeongwangWind'
import Skeleton from '../common/Skeleton'
import './PCWeatherSummary.css'

// icon(5종) → mood(4종): HomeWeatherHero와 동일한 매핑(표시 로직 중복 방지를 위해
// 이 파일에서 한 곳에만 둔다 — pickGreeting의 mood 인자 shape과 맞추기 위함).
const SKY_MOOD = {
  sunny: 'sunny',
  partly_cloudy: 'sunny',
  cloudy: 'cloudy',
  rainy: 'rainy',
  snowy: 'snowy',
}

/**
 * PCWeatherSummary — PC 좌측 사이드바(폭 약 210px)용 경량 날씨 위젯.
 *
 * 모바일 HomeWeatherHero의 "글귀 스타일" 감성(pickGreeting 글귀 + 큰 온도 +
 * 정왕풍/강수 메타)을 재현하되, 무거운 파티클 애니메이션(비/눈/구름/별 레이어)은
 * 이식하지 않는다. useWeather/pickGreeting/describeJeongwangWind/SKY_ICON은
 * HomeWeatherHero와 동일한 헬퍼를 그대로 재사용한다(mistakes.md #2 — 표시 로직
 * 인라인 복붙 금지).
 *
 * 로딩(weather===undefined/null) 시 tj-skeleton 스켈레톤을 보여준다.
 */
export default function PCWeatherSummary() {
  const { weather } = useWeather()

  const icon = weather?.icon ?? 'sunny'
  const mood = SKY_MOOD[icon] ?? 'sunny'
  const Icon = SKY_ICON[icon] ?? Sun

  const greeting = useMemo(
    () => pickGreeting({ mood, rainProb: weather?.rainProb, windSpeed: weather?.windSpeed, temp: weather?.currentTemp }),
    [mood, weather?.rainProb, weather?.windSpeed, weather?.currentTemp],
  )

  const wind = describeJeongwangWind(weather?.windSpeed ?? null)

  if (!weather) {
    return (
      <div className="pcws" data-testid="pc-weather-summary-loading" aria-hidden="true">
        <Skeleton height="1rem" width="70%" className="mb-1.5" />
        <Skeleton height="1rem" width="55%" className="mb-3" />
        <Skeleton height="2.5rem" width="60%" className="mb-2" />
        <Skeleton height="0.85rem" width="80%" />
      </div>
    )
  }

  const greetingLines = greeting.text.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ))

  return (
    <div className="pcws" data-mood={mood}>
      <p className="pcws-quote text-caption font-semibold text-ink-2 dark:text-mute [text-wrap:balance]">
        {greetingLines}
      </p>

      <div className="pcws-main">
        <div className="pcws-temp-row">
          <span className="pcws-temp tabular-nums text-ink dark:text-ink">
            {weather.currentTemp != null ? `${weather.currentTemp}°` : '--'}
          </span>
          <span className="pcws-sky text-caption font-bold text-ink-2 dark:text-mute">
            {SKY_TEXT[icon] ?? ''}
          </span>
        </div>
        <Icon size={26} strokeWidth={1.7} className="pcws-icon text-ink-2 dark:text-mute" aria-hidden="true" />
      </div>

      <div className="pcws-meta text-caption text-ink-2 dark:text-mute">
        {wind && (
          <span className="truncate">
            정왕풍 <span className="tabular-nums">{wind.value}</span>
            <span className="opacity-80"> · {wind.phrase}</span>
          </span>
        )}
        {weather.rainProb != null && weather.rainProb > 0 && (
          <span className="tabular-nums whitespace-nowrap">
            강수 {weather.rainProb}%
          </span>
        )}
        {weather.pm10Grade != null && (
          <span className="whitespace-nowrap">미세먼지 {weather.pm10Grade}</span>
        )}
      </div>
    </div>
  )
}
