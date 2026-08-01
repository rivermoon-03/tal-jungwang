import { useMemo } from 'react'
import { SKY_ICON, SKY_TEXT } from './skyDisplay'
import { useWeather } from '../../hooks/useWeather'
import { useApi } from '../../hooks/useApi'

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
      <div className="text-caption font-bold text-mute mb-1.5">이후 기온 변화</div>
      <div className="relative" style={{ height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="wc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tj-ease)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--tj-ease)" stopOpacity="0" />
            </linearGradient>
            <filter id="wc-glow" x="-5%" y="-60%" width="110%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={fillD} fill="url(#wc-fill)" />
          <path
            d={pathD}
            stroke="var(--tj-ease)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
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
                fill="var(--tj-ink)"
                opacity={isMax || isMin ? 0.75 : 0.40}
              />
            )
          })}
        </svg>

        {maxIdx >= 0 && (
          <div
            className="absolute pointer-events-none text-caption font-bold tabular-nums text-imminent"
            style={{
              left: `${(coords[maxIdx].x / W) * 100}%`,
              top: `${Math.max(0, coords[maxIdx].y - 15)}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {maxT}°
          </div>
        )}
        {minIdx >= 0 && minIdx !== maxIdx && (
          <div
            className="absolute pointer-events-none text-caption font-bold tabular-nums text-ease"
            style={{
              left: `${(coords[minIdx].x / W) * 100}%`,
              top: `${Math.min(H - 14, coords[minIdx].y + 4)}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {minT}°
          </div>
        )}
      </div>
      <div className="flex justify-between px-1 text-caption font-semibold tabular-nums text-mute mt-1">
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

  const TomorrowIcon = tomorrowSummary ? (SKY_ICON[tomorrowSummary.icon] ?? SKY_ICON.sunny) : null

  return (
    <article className="relative overflow-hidden rounded-card-lg bg-surface shadow-card-md">
      <div className="p-4">
        {/* 현재 온도/하늘 상태는 이미 위쪽 StatusChips 스트립(대시보드 스타일 요약 칩)이
            보여주므로 여기서 아이콘+큰 숫자로 다시 반복하지 않는다(결함 #6 — 32° 타일
            중복). 이 카드는 오늘 최고/최저·강수확률과 시간대별 추이처럼 스트립에
            없는 정보만 보탠다. */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-caption font-bold text-mute tracking-wide">오늘 기온 추이</h3>
          <div className="flex items-center gap-2.5 text-caption font-semibold text-mute">
            {todayHigh != null && (
              <span>
                <span className="text-imminent font-semibold">↑</span>{' '}
                <span className="text-ink-2 font-semibold tabular-nums">{todayHigh}°</span>
              </span>
            )}
            {todayLow != null && (
              <span>
                <span className="text-ease font-semibold">↓</span>{' '}
                <span className="text-ink-2 font-semibold tabular-nums">{todayLow}°</span>
              </span>
            )}
            {weather?.rainProb != null && weather.rainProb > 0 && (
              <span>강수 <span className="text-ink-2 font-semibold tabular-nums">{weather.rainProb}%</span></span>
            )}
          </div>
        </div>

        {/* 기온 변화 스파크라인 */}
        <TempSparkline points={sparkPoints} />

        {/* 내일 날씨 */}
        {tomorrowSummary && TomorrowIcon && (
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
            <span className="text-caption font-bold text-mute tracking-wide">내일</span>
            <div className="flex items-center gap-2">
              <TomorrowIcon size={18} strokeWidth={1.6} className="text-mute" aria-hidden="true" />
              <span className="text-label font-semibold text-ink-2">
                {SKY_TEXT[tomorrowSummary.icon] ?? ''}
              </span>
              <span className="text-body font-semibold tabular-nums text-ink tracking-tight">
                {tomorrowSummary.high}° / {tomorrowSummary.low}°
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
