import { useMemo } from 'react'
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import { useApi } from '../../hooks/useApi'

const SKY_ICON = {
  sunny:         Sun,
  partly_cloudy: CloudSun,
  cloudy:        Cloud,
  rainy:         CloudRain,
  snowy:         CloudSnow,
}

const SKY_TEXT = {
  sunny:         '맑음',
  partly_cloudy: '구름많음',
  cloudy:        '흐림',
  rainy:         '비',
  snowy:         '눈',
}

// CrowdingCard 배경과 같은 어두운 그라디언트 계열, 날씨별로 hue만 미세하게 다름
const CARD_BG = {
  sunny:         'linear-gradient(165deg, #0c3050 0%, #10223c 55%, #0a1628 100%)',
  partly_cloudy: 'linear-gradient(165deg, #172238 0%, #1b2b3f 55%, #0f172a 100%)',
  cloudy:        'linear-gradient(165deg, #1a2035 0%, #1e2535 55%, #111827 100%)',
  rainy:         'linear-gradient(165deg, #0d1520 0%, #131c2e 55%, #0a0f1c 100%)',
  snowy:         'linear-gradient(165deg, #162040 0%, #1c2a44 55%, #0f172a 100%)',
}

function toDateStr(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function TempSparkline({ points }) {
  if (points.length < 2) return null

  const W = 400, H = 72, padX = 14, padY = 14
  const temps  = points.map((p) => p.temp)
  const minT   = Math.min(...temps)
  const maxT   = Math.max(...temps)
  const range  = maxT - minT || 1

  const coords = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * (W - 2 * padX),
    y: padY + (1 - (p.temp - minT) / range) * (H - 2 * padY),
    ...p,
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const fillD = `${pathD} L${coords[coords.length - 1].x.toFixed(1)},${H} L${coords[0].x.toFixed(1)},${H} Z`

  const maxIdx = coords.findIndex((c) => c.temp === maxT)
  const minIdx = coords.findIndex((c) => c.temp === minT)

  return (
    <div className="mt-4">
      <div className="text-[10px] text-white/40 mb-1">이후 기온 변화</div>
      <div className="relative" style={{ height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="wc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(125,211,252,0.20)" />
              <stop offset="100%" stopColor="rgba(125,211,252,0)" />
            </linearGradient>
            <filter id="wc-glow" x="-5%" y="-60%" width="110%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={fillD} fill="url(#wc-fill)" />
          <path
            d={pathD}
            stroke="rgba(125,211,252,0.90)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#wc-glow)"
          />
          {coords.map((c, i) => {
            const isMax = i === maxIdx
            const isMin = i === minIdx && i !== maxIdx
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={isMax || isMin ? 3.8 : 2.4}
                fill="white"
                opacity={isMax || isMin ? 0.85 : 0.55}
              />
            )
          })}
        </svg>

        {maxIdx >= 0 && (
          <div
            className="absolute pointer-events-none font-bold tabular-nums"
            style={{
              left: `${(coords[maxIdx].x / W) * 100}%`,
              top: `${Math.max(0, coords[maxIdx].y - 15)}px`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'rgba(253,224,71,0.92)',
              textShadow: '0 1px 5px rgba(0,0,0,.85)',
            }}
          >
            {maxT}°
          </div>
        )}
        {minIdx >= 0 && minIdx !== maxIdx && (
          <div
            className="absolute pointer-events-none font-bold tabular-nums"
            style={{
              left: `${(coords[minIdx].x / W) * 100}%`,
              top: `${Math.min(H - 14, coords[minIdx].y + 4)}px`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'rgba(147,197,253,0.88)',
              textShadow: '0 1px 5px rgba(0,0,0,.85)',
            }}
          >
            {minT}°
          </div>
        )}
      </div>
      <div className="flex justify-between px-1 text-[10px] tabular-nums text-white/35 mt-0.5">
        {points.map((p) => <span key={p.hour}>{p.hour}시</span>)}
      </div>
    </div>
  )
}

export default function WeatherCard() {
  const { weather } = useWeather()
  const { data: forecastData } = useApi('/weather/forecast?hours=36')

  const { todayHigh, todayLow, tomorrowSummary } = useMemo(() => {
    if (!forecastData?.items) return { todayHigh: null, todayLow: null, tomorrowSummary: null }

    const now         = new Date()
    const todayStr    = toDateStr(now)
    const tomorrowStr = toDateStr(new Date(now.getTime() + 24 * 3600 * 1000))

    const todayItems    = forecastData.items.filter((i) => i.date === todayStr)
    const tomorrowItems = forecastData.items.filter((i) => i.date === tomorrowStr)

    const todayTemps    = todayItems.map((i) => i.temp)
    const tomorrowTemps = tomorrowItems.map((i) => i.temp)

    const todayHigh = todayTemps.length    ? Math.max(...todayTemps)    : null
    const todayLow  = todayTemps.length    ? Math.min(...todayTemps)    : null

    let tomorrowSummary = null
    if (tomorrowTemps.length) {
      const skyCounts = {}
      tomorrowItems.forEach((i) => { skyCounts[i.icon] = (skyCounts[i.icon] ?? 0) + 1 })
      const topSky = Object.entries(skyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'sunny'
      tomorrowSummary = { high: Math.max(...tomorrowTemps), low: Math.min(...tomorrowTemps), icon: topSky }
    }

    return { todayHigh, todayLow, tomorrowSummary }
  }, [forecastData])

  const sparkPoints = useMemo(() => {
    if (!forecastData?.items) return weather?.nextTemps ?? []
    const now = new Date()
    const curHour = now.getHours() + now.getMinutes() / 60
    const todayStr = toDateStr(now)
    const tomorrowStr = toDateStr(new Date(now.getTime() + 24 * 3600 * 1000))

    return forecastData.items
      .filter((item) => {
        if (!item.time) return false
        const h = parseInt(item.time.slice(0, 2))
        return (item.date === todayStr || item.date === tomorrowStr) && h >= curHour - 0.5
      })
      .map((item) => ({
        hour: parseInt(item.time.slice(0, 2)),
        temp: item.temp,
      }))
      .sort((a, b) => a.hour - b.hour)
  }, [forecastData, weather])

  const icon        = weather?.icon ?? 'sunny'
  const bg          = CARD_BG[icon] ?? CARD_BG.sunny
  const Icon        = SKY_ICON[icon] ?? Sun

  const TomorrowIcon = tomorrowSummary ? (SKY_ICON[tomorrowSummary.icon] ?? Sun) : null

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-white/5 shadow-sm"
      style={{ background: bg }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.45) 100%)' }}
      />

      <div className="relative p-5">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-white/50">정왕역 날씨</div>
            <div className="mt-1.5 leading-none">
              <span className="text-5xl font-extrabold text-white tabular-nums tracking-tight">
                {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--'}
              </span>
            </div>
            <div className="mt-2 text-sm font-medium text-white/75">
              {SKY_TEXT[icon] ?? weather?.currentSky ?? ''}
            </div>
          </div>

          <Icon
            size={48}
            strokeWidth={1.4}
            className="text-white/70 shrink-0"
            aria-hidden="true"
          />
        </div>

        {/* 오늘 최고/최저 */}
        <div className="mt-3 flex gap-4 text-sm text-white/60">
          {todayHigh != null && (
            <span>최고 <span className="font-semibold text-white">{todayHigh}°</span></span>
          )}
          {todayLow != null && (
            <span>최저 <span className="font-semibold text-white">{todayLow}°</span></span>
          )}
          {weather?.rainProb != null && weather.rainProb > 0 && (
            <span>강수 <span className="font-semibold text-white">{weather.rainProb}%</span></span>
          )}
        </div>

        {/* 기온 변화 스파크라인 */}
        <TempSparkline points={sparkPoints} />

        {/* 내일 날씨 */}
        {tomorrowSummary && TomorrowIcon && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/50">내일</span>
            <div className="flex items-center gap-2">
              <TomorrowIcon size={18} strokeWidth={1.6} className="text-white/60" aria-hidden="true" />
              <span className="text-sm text-white/65">
                {SKY_TEXT[tomorrowSummary.icon] ?? ''}
              </span>
              <span className="text-sm font-semibold text-white">
                {tomorrowSummary.high}° / {tomorrowSummary.low}°
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
