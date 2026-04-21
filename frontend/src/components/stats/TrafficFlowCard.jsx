import { useEffect, useMemo, useState } from 'react'
import { useTrafficFlow } from '../../hooks/useTrafficFlow'
import { useTrafficLive } from '../../hooks/useTrafficLive'
import ChartSkeleton from './ChartSkeleton'
import FlowChart from './FlowChart'

const DIRECTION_TABS = [
  { id: 'to_school',  label: '등교', hint: '정왕역 → 학교' },
  { id: 'to_station', label: '하교', hint: '학교 → 정왕역' },
]

const RANGE_H = 8 // 지금부터 앞으로 8시간

function isWeekend(d = new Date()) {
  return d.getDay() === 0 || d.getDay() === 6
}

function speedStatus(kmh) {
  if (kmh == null) return { label: '--', sub: null, color: 'rgba(148,163,184,1)' }
  if (kmh >= 17) return { label: '원활', sub: `${kmh.toFixed(0)} km/h`, color: 'rgb(52,211,153)' }
  if (kmh >= 10) return { label: '서행', sub: `${kmh.toFixed(0)} km/h`, color: 'rgb(251,191,36)' }
  return { label: '정체', sub: `${kmh.toFixed(0)} km/h`, color: 'rgb(248,113,113)' }
}

export default function TrafficFlowCard() {
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const [direction, setDirection] = useState('to_school')

  const { data: flow, loading: flowLoading } = useTrafficFlow(dayType, direction)
  const { road: live } = useTrafficLive('마유로', direction, { interval: 30000 })

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const points     = flow?.points ?? []
  const sampleDays = flow?.sample_days ?? 0
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const status = speedStatus(live?.speed ?? null)

  // 앞으로 N시간 범위의 x축 라벨
  const xAxisLabels = useMemo(() => {
    const lo = Math.max(0, nowMinutes - 60)
    const hi = Math.min(1440, nowMinutes + RANGE_H * 60)
    const step = (hi - lo) / 4
    return Array.from({ length: 5 }, (_, i) => {
      const m = lo + step * i
      return `${String(Math.floor(m / 60)).padStart(2, '0')}시`
    })
  }, [nowMinutes])

  // 이후 구간 중 가장 막히는 피크 찾기
  const futurePeak = useMemo(() => {
    const hiMin = Math.min(1440, nowMinutes + RANGE_H * 60)
    const future = points.filter((p) => {
      const m = p.hour * 60 + (p.minute ?? 0)
      return m > nowMinutes && m <= hiMin
    })
    if (!future.length) return null
    const worst = future.reduce((a, b) => (a.speed < b.speed ? a : b))
    if (worst.speed >= 17) return null // 원활하면 표시 안 함
    const label = worst.speed >= 10 ? '서행' : '정체'
    return { hour: worst.hour, minute: worst.minute ?? 0, label, speed: worst.speed }
  }, [points, nowMinutes])

  const hasData = points.length > 0

  return (
    <article
      className="relative overflow-hidden rounded-3xl shadow-sm"
      style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0c1220 100%)' }}
    >
      <div className="p-5">
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-bold text-white">마유로 교통 흐름</div>
            <div className="mt-0.5 text-xs text-white/40">
              {dayType === 'weekday' ? '평일' : '주말'}
              {sampleDays > 0 ? ` · 최근 ${sampleDays}일 평균` : ''}
            </div>
          </div>

          {/* 방향 토글 */}
          <div className="flex rounded-full p-0.5 bg-white/8 ring-1 ring-white/12 shrink-0">
            {DIRECTION_TABS.map((tab) => {
              const active = tab.id === direction
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDirection(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                    active ? 'bg-white text-slate-900 shadow-sm' : 'text-white/55 hover:text-white'
                  }`}
                >
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
            <div
              className="text-4xl font-extrabold tracking-tight leading-none"
              style={{ color: status.color }}
            >
              {status.label}
            </div>
            {status.sub && (
              <div className="mt-1 text-sm text-white/50 tabular-nums">{status.sub}</div>
            )}
          </div>
          {futurePeak && (
            <div className="text-right">
              <div className="text-xs text-white/40 mb-1">
                {String(futurePeak.hour).padStart(2, '0')}시경 예상
              </div>
              <div className="text-lg font-bold" style={{ color: futurePeak.speed >= 10 ? 'rgb(251,191,36)' : 'rgb(248,113,113)' }}>
                {futurePeak.label}
              </div>
            </div>
          )}
        </div>

        {/* 차트 */}
        <div key={`${dayType}-${direction}`} className="mt-5 animate-fade-in">
          {flowLoading && !hasData ? (
            <ChartSkeleton stroke="rgba(255,255,255,0.6)" />
          ) : !hasData ? (
            <div className="h-28 flex items-center justify-center text-xs text-white/35">
              아직 누적된 데이터가 없어요
            </div>
          ) : (
            <FlowChart
              points={points}
              stroke="rgba(255,255,255,0.85)"
              nowMinutes={nowMinutes}
              rangeH={RANGE_H}
              futureMode
            />
          )}
        </div>

        {/* X축 라벨 */}
        {hasData && (
          <div className="mt-1 flex justify-between px-1 text-[10px] tabular-nums text-white/30">
            {xAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        )}
      </div>
    </article>
  )
}
