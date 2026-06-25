import { useEffect, useMemo, useState } from 'react'
import { useCrowdingFlow } from '../../hooks/useCrowdingFlow'
import { crowdedColor, crowdedLabel, ROUTE_ACCENTS } from '../../utils/crowdingPalette'
import ChartSkeleton from './ChartSkeleton'
import CrowdingChart from './CrowdingChart'

const ROUTE_TABS = [
  { id: '시흥33', label: '시흥33' },
  { id: '20-1',  label: '20-1'   },
  { id: '시흥1', label: '시흥1'  },
  { id: '11-A',  label: '11-A'   },
]

const RANGE_H = 8

function isWeekend(d = new Date()) {
  return d.getDay() === 0 || d.getDay() === 6
}

export default function CrowdingCard() {
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const [routeNo, setRouteNo] = useState('시흥33')

  const { data, loading } = useCrowdingFlow(routeNo, dayType)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const points    = data?.points ?? []
  const sampleDays = data?.sample_days ?? 0
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const accent     = ROUTE_ACCENTS[routeNo] ?? '#38bdf8'

  const currentPoint = useMemo(() => {
    if (!points.length) return null
    const h = now.getHours()
    const m = now.getMinutes() < 30 ? 0 : 30
    return points.find((p) => p.hour === h && p.minute === m) ?? null
  }, [points, now])

  const futurePeak = useMemo(() => {
    const hiMin = Math.min(1440, nowMinutes + RANGE_H * 60)
    const future = points.filter((p) => {
      const m = p.hour * 60 + p.minute
      return m > nowMinutes && m <= hiMin
    })
    if (!future.length) return null
    return future.reduce((a, b) => (a.crowded > b.crowded ? a : b))
  }, [points, nowMinutes])

  const hasData = points.length > 0

  // x축 라벨 (지금부터 앞으로)
  const xAxisLabels = useMemo(() => {
    const lo = Math.max(0, nowMinutes - 60)
    const hi = Math.min(1440, nowMinutes + RANGE_H * 60)
    const step = (hi - lo) / 4
    return Array.from({ length: 5 }, (_, i) => {
      const m = lo + step * i
      return `${String(Math.floor(m / 60)).padStart(2, '0')}시`
    })
  }, [nowMinutes])

  return (
    <article className="relative overflow-hidden rounded-card-lg bg-surface shadow-card-md">
      {/* 노선별 상단 accent halo — 배경색 위에 살짝 얹히는 미세 tint */}
      <div
        className="absolute inset-x-0 top-0 h-24 pointer-events-none transition-colors duration-500"
        style={{ background: `radial-gradient(120% 60% at 50% -10%, ${accent}18 0%, transparent 70%)` }}
      />

      <div className="relative p-5">
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="text-head text-ink">노선별 혼잡도</div>
            <div className="mt-0.5 text-caption text-mute leading-snug">
              {data?.stop_name && data?.route_direction
                ? `${data.stop_name} 출발 · ${data.route_direction}`
                : `${dayType === 'weekday' ? '평일' : '주말'}${sampleDays > 0 ? ` · 최근 ${sampleDays}일` : ''}`
              }
            </div>
          </div>

          {/* 노선 탭 */}
          <div
            className="flex gap-0.5 rounded-full p-0.5 bg-surface-2 ring-1 ring-line shrink-0"
            role="tablist"
          >
            {ROUTE_TABS.map((tab) => {
              const active = tab.id === routeNo
              const color = ROUTE_ACCENTS[tab.id] ?? accent
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRouteNo(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-label font-semibold rounded-full transition ${
                    active ? 'bg-accent text-accent-ink shadow-sm' : 'text-mute hover:text-ink'
                  }`}
                >
                  {active && (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                  )}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </header>

        {/* 현재 상태 */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-caption text-mute mb-1">지금</div>
            {currentPoint ? (
              <div
                className="text-eta font-extrabold tracking-tight leading-none"
                style={{ color: crowdedColor(currentPoint.crowded) }}
              >
                {crowdedLabel(currentPoint.crowded)}
              </div>
            ) : (
              <div className="text-title font-extrabold text-mute leading-none">--</div>
            )}
          </div>
          {futurePeak && futurePeak.crowded >= 2.5 && (
            <div className="text-right">
              <div className="text-caption text-mute mb-1">
                {String(futurePeak.hour).padStart(2, '0')}:{String(futurePeak.minute).padStart(2, '0')}경 예상
              </div>
              <div
                className="text-head font-bold"
                style={{ color: crowdedColor(futurePeak.crowded) }}
              >
                {crowdedLabel(futurePeak.crowded)}
              </div>
            </div>
          )}
        </div>

        {/* 차트 — 데이터 없으면 숨김 */}
        {loading && !hasData ? (
          <div className="mt-5">
            <ChartSkeleton stroke="var(--tj-line)" />
          </div>
        ) : hasData ? (
          <>
            <div key={`${routeNo}-${dayType}`} className="mt-5 animate-fade-in">
              <CrowdingChart
                points={points}
                nowMinutes={nowMinutes}
                stroke="var(--tj-mute)"
                rangeH={RANGE_H}
                futureMode
              />
            </div>
            <div className="mt-1 flex justify-between px-1 text-caption tabular-nums text-mute">
              {xAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </>
        ) : (
          <div className="mt-4 text-caption text-mute text-center py-4">
            아직 누적된 혼잡도 데이터가 없어요
          </div>
        )}
      </div>
    </article>
  )
}
