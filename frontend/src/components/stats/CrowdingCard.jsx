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
    <article
      className="relative overflow-hidden rounded-3xl shadow-sm"
      style={{ background: 'linear-gradient(160deg, #111827 0%, #1e293b 60%, #0f172a 100%)' }}
    >
      {/* 노선별 상단 accent halo */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none transition-colors duration-500"
        style={{ background: `radial-gradient(130% 70% at 50% -10%, ${accent}22 0%, transparent 60%)` }}
      />

      <div className="relative p-5">
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-white">노선별 혼잡도</div>
            <div className="mt-0.5 text-xs text-white/40 leading-snug">
              {data?.stop_name && data?.route_direction
                ? `${data.stop_name} 출발 · ${data.route_direction}`
                : `${dayType === 'weekday' ? '평일' : '주말'}${sampleDays > 0 ? ` · 최근 ${sampleDays}일` : ''}`
              }
            </div>
          </div>

          {/* 노선 탭 */}
          <div
            className="flex gap-0.5 rounded-full p-0.5 bg-white/5 ring-1 ring-white/10 shrink-0"
            role="tablist"
          >
            {ROUTE_TABS.map((tab) => {
              const active = tab.id === routeNo
              const color = ROUTE_ACCENTS[tab.id] ?? '#94a3b8'
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRouteNo(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition ${
                    active ? 'bg-white text-slate-900 shadow-sm' : 'text-white/60 hover:text-white'
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
            <div className="text-xs text-white/40 mb-1">지금</div>
            {currentPoint ? (
              <div
                className="text-4xl font-extrabold tracking-tight leading-none"
                style={{ color: crowdedColor(currentPoint.crowded) }}
              >
                {crowdedLabel(currentPoint.crowded)}
              </div>
            ) : (
              <div className="text-3xl font-extrabold text-white/25 leading-none">--</div>
            )}
          </div>
          {futurePeak && futurePeak.crowded >= 2.5 && (
            <div className="text-right">
              <div className="text-xs text-white/40 mb-1">
                {String(futurePeak.hour).padStart(2, '0')}:{String(futurePeak.minute).padStart(2, '0')}경 예상
              </div>
              <div
                className="text-lg font-bold"
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
            <ChartSkeleton stroke="rgba(255,255,255,0.5)" />
          </div>
        ) : hasData ? (
          <>
            <div key={`${routeNo}-${dayType}`} className="mt-5 animate-fade-in">
              <CrowdingChart
                points={points}
                nowMinutes={nowMinutes}
                stroke="rgba(255,255,255,0.7)"
                rangeH={RANGE_H}
                futureMode
              />
            </div>
            <div className="mt-1 flex justify-between px-1 text-[10px] tabular-nums text-white/30">
              {xAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </>
        ) : (
          <div className="mt-4 text-xs text-white/30 text-center py-4">
            아직 누적된 혼잡도 데이터가 없어요
          </div>
        )}
      </div>
    </article>
  )
}
