import { useState, useEffect } from 'react'
import { Bus } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'

const DIR_KEY = {
  '정왕역행 (하교)': 'station',
  '학교행 (등교)':   'school',
  '정왕역방면':      'station',
  '정왕역→학교':    'school',
  '하교 (정왕역행)': 'station',
  '등교 (학교행)':   'school',
}

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function findNextTwo(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const upcoming = times.filter((t) => toMin(t.depart_at) > nowMin)
  return [upcoming[0] ?? null, upcoming[1] ?? null]
}

function TimeCell({ label, emoji, pair }) {
  const [next, afterNext] = pair
  return (
    <div className="p-3">
      <p className="text-xs font-bold text-slate-400 mb-1.5">{emoji} {label}</p>
      {next ? (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-extrabold text-navy dark:text-blue-300 tabular-nums">
              {next.depart_at}
            </span>
            <span className="text-[10px] font-bold text-white bg-navy dark:bg-blue-600 rounded px-1.5 py-0.5">
              다음
            </span>
          </div>
          {afterNext && (
            <p className="text-xs text-slate-400 mt-1">다다음 {afterNext.depart_at}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400 mt-1">운행 종료</p>
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
  const info = { station: [null, null], school: [null, null] }
  for (const dir of directions) {
    const key = DIR_KEY[dir.direction]
    if (key) info[key] = findNextTwo(dir.times ?? [])
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
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
          <TimeCell label="정왕역" emoji="📍" pair={info.station} />
          <TimeCell label="학교" emoji="🏫" pair={info.school} />
        </div>
      )}
    </div>
  )
}
