import { useEffect, useMemo, useState } from 'react'
import { useTrafficFlow } from '../../hooks/useTrafficFlow'
import { useTrafficLive } from '../../hooks/useTrafficLive'
import { isDaytime, skyPalette } from '../../utils/flowPalette'
import ChartSkeleton from './ChartSkeleton'
import FlowChart from './FlowChart'

const DIRECTION_TABS = [
  { id: 'to_school', label: '등교 방향', hint: '정왕역 → 학교' },
  { id: 'to_station', label: '하교 방향', hint: '학교 → 정왕역' },
]

function isWeekend(d = new Date()) {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

export default function TrafficFlowCard() {
  const dayType = isWeekend() ? 'weekend' : 'weekday'
  const [direction, setDirection] = useState('to_school')

  const { data: flow, loading: flowLoading } = useTrafficFlow(dayType, direction)
  const { road: live } = useTrafficLive('마유로', direction, { interval: 30000 })

  // 1분 tick으로 배경 팔레트/현재 시각 선을 재계산.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const palette = useMemo(() => skyPalette(now), [now])
  const day = isDaytime(now)
  const stroke = day ? '#0f172a' : '#ffffff'
  const textMain = day ? 'text-slate-900' : 'text-white'
  const textSub = day ? 'text-slate-700/80' : 'text-white/80'
  const textMuted = day ? 'text-slate-700/60' : 'text-white/60'
  const chipBg = day ? 'bg-black/5' : 'bg-white/15'
  const chipActiveBg = day ? 'bg-white/80 text-slate-900' : 'bg-white text-slate-900'

  const points = flow?.points ?? []
  const sampleDays = flow?.sample_days ?? 0

  const avgSpeed = useMemo(() => {
    if (points.length === 0) return null
    const sum = points.reduce((acc, p) => acc + p.speed, 0)
    return sum / points.length
  }, [points])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-black/5 shadow-sm transition-colors duration-1000"
      style={{
        background: `linear-gradient(160deg, ${palette.top} 0%, ${palette.bottom} 100%)`,
      }}
    >
      {/* 가독성 보강 오버레이 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: day
            ? 'radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 60%)'
            : 'radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 60%)',
        }}
      />

      <div className="relative p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`text-xs font-medium ${textSub}`}>마유로 교통흐름</div>
            <div className={`mt-0.5 text-[11px] tabular-nums ${textMuted}`}>
              {dayType === 'weekday' ? '평일' : '주말'} · 최근 {sampleDays}일 평균
              {avgSpeed != null && (
                <>
                  {' · 평균 '}
                  <span className="font-semibold">{avgSpeed.toFixed(1)}</span> km/h
                </>
              )}
            </div>
          </div>

          <div className="text-right leading-none shrink-0">
            <div className={`text-[10px] ${textMuted} mb-1`}>현재</div>
            <div className={`flex items-baseline justify-end gap-1 ${textMain}`}>
              <span className="text-4xl font-extrabold tabular-nums tracking-tight">
                {live?.speed != null ? live.speed.toFixed(1) : '--'}
              </span>
              <span className={`text-xs font-semibold ${textSub}`}>km/h</span>
            </div>
            {live?.congestion_label && (
              <div className={`mt-1 text-[11px] font-medium ${textSub}`}>
                {live.congestion_label}
              </div>
            )}
          </div>
        </header>

        {/* 방향 토글 */}
        <div
          className={`mt-4 inline-flex rounded-full p-0.5 ${chipBg} backdrop-blur-sm`}
        >
          {DIRECTION_TABS.map((tab) => {
            const active = tab.id === direction
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDirection(tab.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  active ? chipActiveBg + ' shadow-sm' : `${textSub} hover:opacity-90`
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 차트 — 방향 전환 시 key 리마운트로 부드럽게 페이드인 */}
        <div key={`${dayType}-${direction}`} className="mt-4 animate-fade-in">
          {flowLoading && points.length === 0 ? (
            <ChartSkeleton stroke={stroke} />
          ) : points.length === 0 ? (
            <div className={`h-40 flex items-center justify-center text-xs ${textMuted}`}>
              아직 누적된 데이터가 없어요
            </div>
          ) : (
            <FlowChart points={points} stroke={stroke} nowMinutes={nowMinutes} />
          )}
        </div>

        {/* X축 라벨 */}
        <div
          className={`mt-1 flex justify-between px-1 text-[10px] tabular-nums ${textMuted}`}
        >
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>
    </article>
  )
}
