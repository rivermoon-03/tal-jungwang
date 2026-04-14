import { useState, useEffect } from 'react'
import { Bus } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttleCountdown from './ShuttleCountdown'
import ShuttleTimetable from './ShuttleTimetable'

// direction int → 사용자 표시 이름 (0=등교, 1=하교)
const DIRECTION_LABEL = { 0: '학교행 (등교)', 1: '정왕역행 (하교)' }

function dirLabel(dir) {
  return DIRECTION_LABEL[dir] ?? String(dir)
}

function toMin(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function findNextShuttle(timeObjs) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return timeObjs.find((t) => toMin(t.depart_at) > nowMin) ?? null
}

/** 현재 수시운행 구간 안에 있는지 여부.
 *  수시운행 항목 중 이미 지난 것이 하나라도 있고,
 *  다음 항목도 수시운행이면 구간 내로 판단한다. */
function isInsideFrequentWindow(timeObjs) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const hasPastFrequent = timeObjs.some(
    (t) => t.note === '수시운행' && toMin(t.depart_at) <= nowMin
  )
  const next = timeObjs.find((t) => toMin(t.depart_at) > nowMin)
  return hasPastFrequent && next?.note === '수시운행'
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
  void tick
  const nextShuttle = findNextShuttle(timeObjs)
  const inFrequentWindow = isInsideFrequentWindow(timeObjs)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <Bus size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">셔틀버스</h2>
        {schedule && <span className="ml-auto text-sm text-white/60">{schedule.schedule_name}</span>}
      </div>

      {directions.length > 0 && (
        <div className="flex bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          {directions.map(({ direction }) => (
            <button
              key={direction}
              onClick={() => setActiveDir(direction)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
                ${activeDir === direction
                  ? 'text-navy dark:text-blue-400 border-navy dark:border-blue-400'
                  : 'text-slate-500 dark:text-slate-400 border-transparent'}`}
            >
              {dirLabel(direction)}
            </button>
          ))}
        </div>
      )}

      <ShuttleCountdown
        nextShuttle={nextShuttle}
        direction={dirLabel(activeDir)}
        inFrequentWindow={inFrequentWindow}
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
