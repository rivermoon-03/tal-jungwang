import { useState, useEffect } from 'react'
import { Bus, MapPin, School } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'

// direction int → 내부 key (0=등교, 1=하교)
const DIR_KEY = { 0: 'school', 1: 'station' }

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function findNextTwo(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const upcoming = times.filter((t) => toMin(t.depart_at) > nowMin)
  return [upcoming[0] ?? null, upcoming[1] ?? null]
}

/** 수시운행 구간 안에 있는지 여부 (note === '수시운행' 항목 기준). */
function isInsideFrequentWindow(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const hasPastFrequent = times.some((t) => t.note === '수시운행' && toMin(t.depart_at) <= nowMin)
  const next = times.find((t) => toMin(t.depart_at) > nowMin)
  return hasPastFrequent && next?.note === '수시운행'
}

/** 수시운행 회차 구간 안에 있는지 여부.
 *  직전에 지나간 항목이 '회차편 · 학교 수시운행 출발'이면 회차 구간으로 판단. */
function isInsideFrequentReturnWindow(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const lastPast = [...times].reverse().find((t) => toMin(t.depart_at) <= nowMin)
  return !!(lastPast?.note?.startsWith('회차편') && lastPast.note.includes('수시운행'))
}

/** { main: string, sub: string|null } 형태로 반환 */
function departLabel(next, { inFrequent, inFrequentReturn }) {
  if (!next) return null
  if (inFrequent)       return { main: '수시운행', sub: null }
  if (inFrequentReturn) return { main: '수시 회차 중', sub: '수시운행' }
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const diffMin = toMin(next.depart_at) - nowMin

  if (next.note?.startsWith('회차편')) {
    if (diffMin < 1) return { main: '곧 출발', sub: '회차편' }
    return { main: `${diffMin}분 뒤`, sub: '회차편' }
  }
  if (diffMin < 1) return { main: '곧 출발', sub: null }
  return { main: `${diffMin}분 뒤`, sub: null }
}

function TimeCell({ label, Icon, pair, times }) {
  const [next, afterNext] = pair
  const inFrequent       = isInsideFrequentWindow(times)
  const inFrequentReturn = isInsideFrequentReturnWindow(times)
  const countdown = departLabel(next, { inFrequent, inFrequentReturn })
  const hideTime = inFrequent || inFrequentReturn
  return (
    <div className="p-4 md:p-3">
      <p className="text-sm md:text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1"><Icon size={11} /> {label}</p>
      {next ? (
        <>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {!hideTime && (
              <span className="text-xl md:text-[17px] font-extrabold text-navy dark:text-blue-300 tabular-nums">
                {next.depart_at}
              </span>
            )}
            {countdown && (
              <span className={`font-semibold text-blue-500 dark:text-blue-400 ${hideTime ? 'text-xl md:text-[17px]' : 'text-sm md:text-xs'}`}>
                {countdown.main}
              </span>
            )}
          </div>
          {countdown?.sub && (
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">{countdown.sub}</p>
          )}
          {!hideTime && afterNext && (
            <p className="text-sm md:text-xs text-slate-400 mt-1">다다음 {afterNext.depart_at}</p>
          )}
        </>
      ) : (
        <p className="text-sm md:text-xs text-slate-400 mt-1">운행 종료</p>
      )}
    </div>
  )
}

export default function ShuttleCard({ onOpenSheet }) {
  const { data: schedule, loading } = useShuttleSchedule()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  void tick

  const directions = schedule?.directions ?? []
  const info = {
    station: { pair: [null, null], times: [] },
    school:  { pair: [null, null], times: [] },
  }
  for (const dir of directions) {
    const key = DIR_KEY[dir.direction]
    if (key) {
      const times = dir.times ?? []
      info[key] = { pair: findNextTwo(times), times }
    }
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden border border-slate-200 dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <Bus size={16} strokeWidth={2} className="text-navy dark:text-blue-400" />
          <span className="text-sm font-bold text-navy dark:text-blue-300">셔틀버스</span>
          {schedule && (
            <span className="text-xs text-slate-400">{schedule.schedule_name}</span>
          )}
        </div>
        <button
          onClick={onOpenSheet}
          className="text-xs text-blue-500 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          시간표 전체보기 ›
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
          <TimeCell label="정왕역 (하교)" Icon={MapPin} pair={info.station.pair} times={info.station.times} />
          <TimeCell label="학교 (등교)" Icon={School} pair={info.school.pair} times={info.school.times} />
        </div>
      )}
    </div>
  )
}
