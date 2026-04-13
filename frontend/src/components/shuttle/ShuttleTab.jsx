import { useState, useEffect } from 'react'
import { Bus } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttleCountdown from './ShuttleCountdown'
import ShuttleTimetable from './ShuttleTimetable'

// DB route_name → 사용자 표시 이름 (과거 이름 포함, 이전 데이터 호환)
const DIRECTION_LABEL = {
  '정왕역행 (하교)':  '정왕역행 (하교)',
  '학교행 (등교)':    '학교행 (등교)',
  '정왕역방면':       '정왕역행 (하교)',
  '정왕역→학교':     '학교행 (등교)',
  '하교 (정왕역행)':  '정왕역행 (하교)',
  '등교 (학교행)':    '학교행 (등교)',
}

function dirLabel(name) {
  return DIRECTION_LABEL[name] ?? name
}

function findNextShuttle(timeObjs) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return timeObjs.find((t) => {
    const [hh, mm] = t.depart_at.split(':').map(Number)
    return hh * 60 + mm > nowMin
  }) ?? null
}

export default function ShuttleTab() {
  const [activeDir, setActiveDir] = useState(null)
  const [tick, setTick] = useState(0)
  const { data: schedule, loading: schedLoading } = useShuttleSchedule()

  const directions = schedule?.directions ?? []

  useEffect(() => {
    if (!activeDir && directions.length > 0) {
      setActiveDir(directions[0].direction)
    }
  }, [activeDir, directions])

  // 1분마다 강제 재렌더 → findNextTime이 다시 실행되어 다음 차로 전환
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const currentDir = directions.find((d) => d.direction === activeDir)
  const timeObjs = currentDir?.times ?? []
  // tick은 의존성으로만 사용 — 실제 값은 쓰지 않음
  void tick
  const nextShuttle = findNextShuttle(timeObjs)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <Bus size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">셔틀버스</h2>
        {schedule && <span className="ml-auto text-sm text-white/60">{schedule.schedule_name}</span>}
      </div>

      {directions.length > 0 && (
        <div className="flex bg-white border-b border-slate-200">
          {directions.map(({ direction }) => (
            <button
              key={direction}
              onClick={() => setActiveDir(direction)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
                ${activeDir === direction ? 'text-navy border-navy' : 'text-slate-500 border-transparent'}`}
            >
              {dirLabel(direction)}
            </button>
          ))}
        </div>
      )}

      <ShuttleCountdown
        nextShuttle={nextShuttle}
        direction={dirLabel(activeDir)}
      />

      {schedLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">불러오는 중...</p>
        </div>
      ) : (
        <ShuttleTimetable times={timeObjs} />
      )}
    </div>
  )
}
