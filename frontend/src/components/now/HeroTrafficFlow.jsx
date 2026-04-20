// frontend/src/components/now/HeroTrafficFlow.jsx
import { useMemo } from 'react'
import { useTrafficFlow } from '../../hooks/useTrafficFlow'
import { smoothPath } from '../../utils/splinePath'

const W = 320, H = 140, PAD_X = 16, PAD_Y = 16

function isWeekend(d = new Date()) {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

export default function HeroTrafficFlow() {
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const { data } = useTrafficFlow(dayType)
  const raw = data?.points ?? []

  const { pathD, nowX, sampleDays } = useMemo(() => {
    if (raw.length === 0) return { pathD: '', nowX: null, sampleDays: 0 }
    const xs = raw.map((p) => p.hour + p.minute / 60)          // 0..24
    const ys = raw.map((p) => p.congestion)                    // 1..4
    const innerW = W - PAD_X * 2
    const innerH = H - PAD_Y * 2
    const points = raw.map((p, i) => ({
      x: PAD_X + (xs[i] / 24) * innerW,
      y: PAD_Y + (1 - (ys[i] - 1) / 3) * innerH,
    }))
    const pathD = smoothPath(points, 0.5)
    const now = new Date()
    const nowT = (now.getHours() + now.getMinutes() / 60) / 24
    return {
      pathD,
      nowX: PAD_X + nowT * innerW,
      sampleDays: data?.sample_days ?? 0,
    }
  }, [raw, data?.sample_days])

  return (
    <article className="p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
      <header className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-bold text-slate-900 dark:text-slate-100">마유로 흐름</h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {dayType === 'weekday' ? '평일' : '주말'} · 최근 {sampleDays}일 평균
        </span>
      </header>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-2" aria-label="마유로 24시간 혼잡도">
        {/* baseline dashes */}
        {[1, 2, 3].map((g) => {
          const y = PAD_Y + (1 - (g - 1) / 3) * (H - PAD_Y * 2)
          return (
            <line
              key={g}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeDasharray="2 4"
              strokeOpacity="0.15"
            />
          )
        })}
        {/* curve */}
        <path d={pathD} fill="none" stroke="url(#flowGrad)" strokeWidth="2.4" strokeLinecap="round" />
        <defs>
          <linearGradient id="flowGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#f87171" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        {/* now marker */}
        {nowX != null && (
          <line
            x1={nowX}
            x2={nowX}
            y1={PAD_Y}
            y2={H - PAD_Y}
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.35"
          />
        )}
      </svg>

      <div className="flex justify-between mt-1 px-4 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </article>
  )
}
