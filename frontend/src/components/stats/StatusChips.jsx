import { useMemo } from 'react'
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import { useTrafficLive } from '../../hooks/useTrafficLive'
import { useCrowdingFlow } from '../../hooks/useCrowdingFlow'
import { crowdedLabel } from '../../utils/crowdingPalette'

const WEATHER_ICONS = {
  sunny: Sun,
  partly_cloudy: CloudSun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
}

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

function trafficStatus(speed) {
  if (speed == null) return null
  if (speed >= 25) return { label: '원활', cls: 'text-ease' }
  if (speed >= 15) return { label: '서행', cls: 'text-imminent' }
  return { label: '정체', cls: 'text-imminent' }
}

function busStatusCls(label) {
  if (!label) return 'text-mute'
  if (label === '여유') return 'text-ease'
  if (label === '보통') return 'text-imminent'
  return 'text-imminent'
}

export default function StatusChips() {
  const { weather } = useWeather()
  const { road } = useTrafficLive('마유로', 'to_school', { interval: 30000 })
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const { data: crowdData } = useCrowdingFlow('시흥33', dayType)

  const busLabel = useMemo(() => {
    if (!crowdData?.points?.length) return null
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes() < 30 ? 0 : 30
    const pt = crowdData.points.find((p) => p.hour === h && p.minute === m)
    return pt ? crowdedLabel(pt.crowded) : null
  }, [crowdData])

  const WeatherIcon = WEATHER_ICONS[weather?.icon ?? 'sunny'] ?? Sun
  const traffic = trafficStatus(road?.speed)

  return (
    <div className="flex items-center rounded-2xl overflow-hidden mb-4 divide-x divide-line bg-surface-2 ring-1 ring-line">
      {/* 날씨 */}
      <div className="flex flex-col items-center gap-0.5 flex-1 py-3">
        <WeatherIcon size={18} strokeWidth={1.6} className="text-mute" aria-hidden="true" />
        <span className="text-body font-bold text-ink tabular-nums leading-none">
          {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
        </span>
        <span className="text-caption text-mute leading-none">
          {weather?.currentSky ?? '날씨'}
        </span>
      </div>

      {/* 도로 */}
      <div className="flex flex-col items-center gap-0.5 flex-1 py-3">
        <span className="text-caption text-mute leading-none">마유로</span>
        <span className={`text-body font-bold leading-none ${traffic?.cls ?? 'text-mute'}`}>
          {traffic?.label ?? '--'}
        </span>
        {road?.speed != null && (
          <span className="text-caption text-mute tabular-nums leading-none">
            {road.speed.toFixed(0)} km/h
          </span>
        )}
      </div>

      {/* 버스 */}
      <div className="flex flex-col items-center gap-0.5 flex-1 py-3">
        <span className="text-caption text-mute leading-none">시흥33</span>
        <span className={`text-body font-bold leading-none ${busStatusCls(busLabel)}`}>
          {busLabel ?? '--'}
        </span>
        <span className="text-caption text-mute leading-none">혼잡도</span>
      </div>
    </div>
  )
}
