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

const RANGE_TABS = [6, 12, 24]

const LEGEND = [
  { v: 1, label: '여유' },
  { v: 2, label: '보통' },
  { v: 3, label: '혼잡' },
  { v: 4, label: '매우혼잡' },
]

function isWeekend(d = new Date()) {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

function formatHour(hh, mm) {
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export default function CrowdingCard() {
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const [routeNo, setRouteNo] = useState('시흥33')
  const [rangeH, setRangeH] = useState(24)

  const { data, loading } = useCrowdingFlow(routeNo, dayType)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const points = data?.points ?? []
  const sampleDays = data?.sample_days ?? 0
  const totalSamples = data?.total_samples ?? 0
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const currentPoint = useMemo(() => {
    if (points.length === 0) return null
    const curHour = now.getHours()
    const curMinute = now.getMinutes() < 30 ? 0 : 30
    return points.find((p) => p.hour === curHour && p.minute === curMinute) ?? null
  }, [points, now])

  const peakPoint = useMemo(() => {
    if (points.length === 0) return null
    return points.reduce((best, p) => (p.crowded > (best?.crowded ?? 0) ? p : best), null)
  }, [points])

  const accent = ROUTE_ACCENTS[routeNo] ?? '#38bdf8'

  const xAxisLabels = useMemo(() => {
    const curMin = nowMinutes
    const half = (rangeH / 2) * 60
    const lo = Math.max(0, curMin - half)
    const hi = Math.min(1440, curMin + half)
    const step = (hi - lo) / 4
    return Array.from({ length: 5 }, (_, i) => {
      const m = lo + step * i
      return String(Math.floor(m / 60)).padStart(2, '0')
    })
  }, [rangeH, nowMinutes])

  return (
    <article
      className="relative overflow-hidden rounded-3xl shadow-sm border border-white/5"
      style={{
        background: 'linear-gradient(165deg, #111827 0%, #1e293b 60%, #0f172a 100%)',
      }}
    >
      {/* 노선별 상단 halo — 탭마다 다른 분위기만 살짝 */}
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none transition-colors duration-500"
        style={{
          background: `radial-gradient(120% 80% at 50% -10%, ${accent}33 0%, transparent 55%)`,
        }}
      />

      <div className="relative p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-bold text-white">노선별 혼잡도</div>
            <div
              key={`meta-${routeNo}`}
              className="mt-1 text-xs text-white/50 animate-fade-in leading-snug"
            >
              {data?.stop_name && data?.route_direction
                ? <>{data.stop_name} 출발 · {data.route_direction}</>
                : `${dayType === 'weekday' ? '평일' : '주말'} · 최근 ${sampleDays}일`
              }
            </div>
          </div>

          <div className="flex items-start gap-3 shrink-0">
            {/* 시간 범위 탭 */}
            <div className="flex gap-0.5 rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 p-0.5">
              {RANGE_TABS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setRangeH(h)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                    rangeH === h ? 'bg-white text-slate-900' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>

            <div
              key={`now-${routeNo}`}
              className="text-right leading-none animate-fade-in"
            >
              <div className="text-xs text-white/50 mb-1">현재</div>
              {currentPoint ? (
                <div
                  className="text-3xl font-extrabold tabular-nums tracking-tight"
                  style={{ color: crowdedColor(currentPoint.crowded) }}
                >
                  {crowdedLabel(currentPoint.crowded)}
                </div>
              ) : (
                <div className="text-2xl font-extrabold text-white/40">--</div>
              )}
            </div>
          </div>
        </header>

        {/* 노선 탭 */}
        <div
          className="mt-4 inline-flex rounded-full p-0.5 bg-white/5 ring-1 ring-white/10 backdrop-blur-sm"
          role="tablist"
          aria-label="버스 노선"
        >
          {ROUTE_TABS.map((tab) => {
            const active = tab.id === routeNo
            const tabColor = ROUTE_ACCENTS[tab.id] ?? '#94a3b8'
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRouteNo(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: tabColor }}
                />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 차트 — 탭 변경 시 key 리마운트로 부드럽게 페이드인 */}
        <div key={`${routeNo}-${dayType}`} className="mt-4 animate-fade-in">
          {loading && points.length === 0 ? (
            <ChartSkeleton stroke="#ffffff" />
          ) : points.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-white/50">
              아직 누적된 혼잡도 데이터가 없어요
            </div>
          ) : (
            <CrowdingChart points={points} nowMinutes={nowMinutes} stroke="#ffffff" rangeH={rangeH} />
          )}
        </div>

        {/* X축 라벨 */}
        <div className="mt-1 flex justify-between px-1 text-[10px] tabular-nums text-white/40">
          {xAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
        </div>

        {/* 범례 + 피크 */}
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {LEGEND.map((l) => (
              <div key={l.v} className="flex items-center gap-1.5 text-xs text-white/70">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: crowdedColor(l.v) }}
                />
                {l.label}
              </div>
            ))}
          </div>
          {peakPoint && (
            <div
              key={`peak-${routeNo}`}
              className="text-xs text-white/70 tabular-nums animate-fade-in"
            >
              피크{' '}
              <span className="font-semibold text-white">
                {formatHour(peakPoint.hour, peakPoint.minute)}
              </span>{' '}
              <span style={{ color: crowdedColor(peakPoint.crowded) }}>
                {crowdedLabel(peakPoint.crowded)}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
