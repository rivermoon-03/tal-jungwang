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
  if (speed >= 17) return { label: '원활', cls: 'text-emerald-400' }
  if (speed >= 10) return { label: '서행', cls: 'text-amber-400' }
  return { label: '정체', cls: 'text-red-400' }
}

function busStatusCls(label) {
  if (!label) return 'text-slate-400'
  if (label === '여유') return 'text-emerald-400'
  if (label === '보통') return 'text-amber-400'
  return 'text-red-400'
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
    <div className="flex items-center rounded-2xl overflow-hidden mb-4 divide-x divide-white/10"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
    >
      {/* 날씨 */}
      <div className="flex flex-col items-center gap-0.5 flex-1 py-3">
        <WeatherIcon size={18} strokeWidth={1.6} className="text-white/55" aria-hidden="true" />
        <span className="text-base font-bold text-white tabular-nums leading-none">
          {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
        </span>
        <span className="text-[10px] text-white/40 leading-none">
          {weather?.currentSky ?? '날씨'}
        </span>
      </div>

      {/* 도로 */}
      <div className="flex flex-col items-center gap-0.5 flex-1 py-3">
        <span className="text-[10px] text-white/40 leading-none">마유로</span>
        <span className={`text-base font-bold leading-none ${traffic?.cls ?? 'text-slate-400'}`}>
          {traffic?.label ?? '--'}
        </span>
        {road?.speed != null && (
          <span className="text-[10px] text-white/35 tabular-nums leading-none">
            {road.speed.toFixed(0)} km/h
          </span>
        )}
      </div>

      {/* 버스 */}
      <div className="flex flex-col items-center gap-0.5 flex-1 py-3">
        <span className="text-[10px] text-white/40 leading-none">시흥33</span>
        <span className={`text-base font-bold leading-none ${busStatusCls(busLabel)}`}>
          {busLabel ?? '--'}
        </span>
        <span className="text-[10px] text-white/35 leading-none">혼잡도</span>
      </div>
    </div>
  )
}
