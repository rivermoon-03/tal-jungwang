import { useEffect, useMemo, useState } from 'react'
import { useTrafficFlow } from '../../hooks/useTrafficFlow'
import { useTrafficLive } from '../../hooks/useTrafficLive'
import { skyPalette } from '../../utils/flowPalette'
import ChartSkeleton from './ChartSkeleton'
import FlowChart from './FlowChart'

const DIRECTION_TABS = [
  { id: 'to_school',  label: '등교 방향', hint: '정왕역 → 학교' },
  { id: 'to_station', label: '하교 방향', hint: '학교 → 정왕역' },
]

const RANGE_TABS = [6, 12, 24]

function isWeekend(d = new Date()) {
  return d.getDay() === 0 || d.getDay() === 6
}

// 시간대별 천체 오버레이
function SkyDecoration({ now }) {
  const totalMin = now.getHours() * 60 + now.getMinutes()
  const isNight = totalMin < 360 || totalMin >= 1140

  if (isNight) {
    return (
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <mask id="tc-crescent">
            <rect width="400" height="200" fill="white" />
            <circle cx="342" cy="38" r="19" fill="black" />
          </mask>
        </defs>
        {[
          [55, 38, 1.5, 0.85], [130, 18, 1, 0.7],   [190, 45, 2, 0.75],
          [240, 14, 1.5, 0.65], [295, 52, 1, 0.88],  [155, 68, 1.5, 0.6],
          [80, 78, 1, 0.72],   [350, 30, 1, 0.68],   [220, 82, 1, 0.62],
          [40, 55, 1.5, 0.7],  [370, 58, 1, 0.78],   [100, 30, 1, 0.55],
          [310, 90, 1, 0.5],   [175, 28, 1.5, 0.6],  [260, 70, 1, 0.65],
        ].map(([x, y, r, op], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={op} />
        ))}
        {/* 달 은은한 외광 */}
        <circle cx="330" cy="45" r="40" fill="rgba(219,234,254,0.04)" />
        <circle cx="330" cy="45" r="28" fill="rgba(219,234,254,0.07)" />
        {/* 초승달 */}
        <circle cx="330" cy="45" r="22" fill="rgba(226,232,240,0.88)" mask="url(#tc-crescent)" />
      </svg>
    )
  }

  // 태양 호 이동: 06:00(360) ~ 18:00(1080)
  const progress = Math.max(0, Math.min(1, (totalMin - 360) / 720))
  const sunX = 35 + 330 * progress
  const sunY = 158 - 132 * Math.sin(Math.PI * progress)

  const isDawn = progress < 0.18
  const isDusk = progress > 0.78

  // 지평선 근처에서 페이드
  const edgeFade = Math.min(1, Math.min(progress, 1 - progress) / 0.1)

  const sunCore = isDawn || isDusk ? 'rgba(251,146,60,0.92)' : 'rgba(253,224,71,0.92)'
  const glow1   = isDawn || isDusk ? 'rgba(251,130,36,0.30)'  : 'rgba(253,224,71,0.22)'
  const glow2   = isDawn || isDusk ? 'rgba(251,100,36,0.12)'  : 'rgba(253,224,71,0.08)'

  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      {/* 노을 지평선 글로우 */}
      {isDusk && (
        <ellipse
          cx="200" cy="200"
          rx="240" ry={Math.round(90 * ((progress - 0.78) / 0.22))}
          fill="rgba(234,88,12,0.20)"
        />
      )}
      {/* 여명 지평선 글로우 */}
      {isDawn && (
        <ellipse
          cx={sunX} cy="200"
          rx="180" ry={Math.round(60 * ((0.18 - progress) / 0.18))}
          fill="rgba(251,146,60,0.15)"
        />
      )}
      <circle cx={sunX} cy={sunY} r="60" fill={glow2} opacity={edgeFade} />
      <circle cx={sunX} cy={sunY} r="34" fill={glow1} opacity={edgeFade} />
      <circle cx={sunX} cy={sunY} r="16" fill={sunCore} opacity={edgeFade} />
    </svg>
  )
}

export default function TrafficFlowCard() {
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const [direction, setDirection] = useState('to_school')
  const [rangeH, setRangeH] = useState(24)

  const { data: flow, loading: flowLoading } = useTrafficFlow(dayType, direction)
  const { road: live } = useTrafficLive('마유로', direction, { interval: 30000 })

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const palette = useMemo(() => skyPalette(now), [now])
  const points     = flow?.points ?? []
  const sampleDays = flow?.sample_days ?? 0
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

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
      className="relative overflow-hidden rounded-3xl border border-white/5 shadow-sm transition-colors duration-1000"
      style={{ background: `linear-gradient(160deg, ${palette.top} 0%, ${palette.bottom} 100%)` }}
    >
      {/* 하단 어둠 레이어 — 텍스트 가독성 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)' }}
      />

      <SkyDecoration now={now} />

      <div className="relative p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-bold text-white">마유로 교통흐름</div>
            <div className="mt-1 text-xs text-white/55">
              {dayType === 'weekday' ? '평일' : '주말'} · 최근 {sampleDays}일
            </div>
          </div>

          <div className="flex items-start gap-3 shrink-0">
            {/* 시간 범위 탭 */}
            <div className="flex gap-0.5 rounded-lg overflow-hidden bg-white/10 p-0.5">
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

            <div className="text-right leading-none">
              <div className="text-xs text-white/55 mb-1">현재</div>
              <div className="flex items-baseline justify-end gap-1 text-white">
                <span className="text-4xl font-extrabold tabular-nums tracking-tight">
                  {live?.speed != null ? live.speed.toFixed(1) : '--'}
                </span>
                <span className="text-xs font-semibold text-white/75">km/h</span>
              </div>
              {live?.congestion_label && (
                <div className="mt-1 text-sm font-semibold text-white/80">
                  {live.congestion_label}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 방향 토글 */}
        <div className="mt-4 inline-flex rounded-full p-0.5 bg-white/10 backdrop-blur-sm">
          {DIRECTION_TABS.map((tab) => {
            const active = tab.id === direction
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDirection(tab.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="ml-1.5 opacity-60 font-normal">{tab.hint}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 차트 */}
        <div key={`${dayType}-${direction}`} className="mt-4 animate-fade-in">
          {flowLoading && points.length === 0 ? (
            <ChartSkeleton stroke="#ffffff" />
          ) : points.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-white/50">
              아직 누적된 데이터가 없어요
            </div>
          ) : (
            <FlowChart points={points} stroke="#ffffff" nowMinutes={nowMinutes} rangeH={rangeH} />
          )}
        </div>

        {/* X축 라벨 */}
        <div className="mt-1 flex justify-between px-1 text-[10px] tabular-nums text-white/40">
          {xAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      </div>
    </article>
  )
}
