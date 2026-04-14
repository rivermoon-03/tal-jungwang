import { useState } from 'react'
import { MapPin, School } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttleTimetable from '../shuttle/ShuttleTimetable'

const DIRECTION_META = {
  '정왕역행 (하교)': { Icon: MapPin, label: '정왕역' },
  '학교행 (등교)':   { Icon: School, label: '학교' },
  '정왕역방면':      { Icon: MapPin, label: '정왕역' },
  '정왕역→학교':    { Icon: School, label: '학교' },
  '하교 (정왕역행)': { Icon: MapPin, label: '정왕역' },
  '등교 (학교행)':   { Icon: School, label: '학교' },
}

function DirLabel({ name }) {
  const meta = DIRECTION_META[name]
  if (!meta) return <span>{name}</span>
  const { Icon, label } = meta
  return <span className="flex items-center justify-center gap-1"><Icon size={13} /> {label}</span>
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
                <DirLabel name={direction} />
              </button>
            )
          })}
        </div>
      )}
      <ShuttleTimetable times={timeObjs} />
    </div>
  )
}
