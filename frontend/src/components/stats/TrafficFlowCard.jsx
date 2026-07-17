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
  if (kmh == null) return { label: '--', sub: null, colorClass: 'text-mute' }
  if (kmh >= 25) return { label: '원활', sub: `${kmh.toFixed(0)} km/h`, colorClass: 'text-ease' }
  if (kmh >= 15) return { label: '서행', sub: `${kmh.toFixed(0)} km/h`, colorClass: 'text-imminent' }
  return { label: '정체', sub: `${kmh.toFixed(0)} km/h`, colorClass: 'text-imminent' }
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
    if (worst.speed >= 25) return null // 원활하면 표시 안 함
    const label = worst.speed >= 15 ? '서행' : '정체'
    return { hour: worst.hour, minute: worst.minute ?? 0, label, speed: worst.speed }
  }, [points, nowMinutes])

  const hasData = points.length > 0

  // 차트 stroke: 현재 테마에서 기준선/현재선에 쓸 중성 색
  const chartStroke = 'var(--tj-mute)'

  return (
    <article className="relative overflow-hidden rounded-card-lg bg-surface shadow-card-md">
      <div className="p-5">
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="text-caption font-semibold text-mute tracking-[0.08em] uppercase">마유로</div>
            <div className="mt-0.5 text-head font-semibold text-ink tracking-tight">교통 흐름</div>
            <div className="mt-1.5 text-caption font-semibold text-mute">
              {dayType === 'weekday' ? '평일' : '주말'}
              {sampleDays > 0 ? ` · 최근 ${sampleDays}일 평균` : ''}
            </div>
          </div>

          {/* 방향 토글 */}
          <div className="flex rounded-full p-[3px] bg-surface-2 ring-1 ring-line shrink-0">
            {DIRECTION_TABS.map((tab) => {
              const active = tab.id === direction
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDirection(tab.id)}
                  className={`px-3.5 py-1.5 text-label font-semibold rounded-full transition tracking-tight ${
                    active ? 'bg-accent text-accent-ink shadow-sm' : 'text-mute hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </header>

        {/* 현재 상태 */}
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-caption font-bold text-mute tracking-wide mb-1.5">지금</div>
            <div className="flex items-baseline gap-2.5">
              <span
                aria-hidden
                className={`self-center w-2.5 h-2.5 rounded-full ${status.colorClass}`}
                style={{ backgroundColor: 'currentColor', boxShadow: 'none' }}
              />
              <span className={`text-eta font-bold tracking-[-0.04em] leading-none ${status.colorClass}`}>
                {status.label}
              </span>
            </div>
            {status.sub && (
              <div className="mt-2 text-label font-bold text-ink-2 tabular-nums">{status.sub}</div>
            )}
          </div>
          {futurePeak && (
            <div className="text-right">
              <div className="text-caption font-bold text-mute tracking-wide mb-1.5">
                {String(futurePeak.hour).padStart(2, '0')}시경 예상
              </div>
              <div className={`text-head font-semibold tracking-tight text-imminent`}>
                {futurePeak.label}
              </div>
            </div>
          )}
        </div>

        {/* 차트 */}
        <div key={`${dayType}-${direction}`} className="mt-5 animate-fade-in">
          {flowLoading && !hasData ? (
            <ChartSkeleton stroke={chartStroke} />
          ) : !hasData ? (
            <div className="h-28 flex items-center justify-center text-caption text-mute">
              아직 누적된 데이터가 없어요
            </div>
          ) : (
            <FlowChart
              points={points}
              stroke={chartStroke}
              nowMinutes={nowMinutes}
              rangeH={RANGE_H}
              futureMode
            />
          )}
        </div>

        {/* X축 라벨 */}
        {hasData && (
          <div className="mt-1 flex justify-between px-1 text-caption tabular-nums text-mute">
            {xAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        )}
      </div>
    </article>
  )
}
