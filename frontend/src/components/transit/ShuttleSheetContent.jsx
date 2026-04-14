import { useState } from 'react'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttleTimetable from '../shuttle/ShuttleTimetable'

const DIRECTION_LABEL = {
  '정왕역행 (하교)': '📍 정왕역',
  '학교행 (등교)':   '🏫 학교',
  '정왕역방면':      '📍 정왕역',
  '정왕역→학교':    '🏫 학교',
  '하교 (정왕역행)': '📍 정왕역',
  '등교 (학교행)':   '🏫 학교',
}

function dirLabel(name) {
  return DIRECTION_LABEL[name] ?? name
}

export default function ShuttleSheetContent() {
  const { data: schedule, loading } = useShuttleSchedule()
  const directions = schedule?.directions ?? []
  const [activeDir, setActiveDir] = useState(null)

  const currentDirKey = activeDir ?? directions[0]?.direction ?? null
  const currentDir = directions.find((d) => d.direction === currentDirKey)
  const timeObjs = currentDir?.times ?? []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {directions.length > 0 && (
        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          {directions.map(({ direction }) => {
            const active = direction === currentDirKey
            return (
              <button
                key={direction}
                onClick={() => setActiveDir(direction)}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
                  ${active
                    ? 'text-navy dark:text-blue-400 border-navy dark:border-blue-400'
                    : 'text-slate-500 dark:text-slate-400 border-transparent'}`}
              >
                {dirLabel(direction)}
              </button>
            )
          })}
        </div>
      )}
      <ShuttleTimetable times={timeObjs} />
    </div>
  )
}
