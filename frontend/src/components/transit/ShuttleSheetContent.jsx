import { useMemo, useState } from 'react'
import { MapPin, School } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttleTimetable from '../shuttle/ShuttleTimetable'

// direction int → 아이콘 + 표시명
// 0=본캠 등교, 1=본캠 하교, 2=2캠 등교, 3=2캠 하교
const DIRECTION_META = {
  0: { Icon: School, label: '학교 (등교)' },
  1: { Icon: MapPin, label: '정왕역 (하교)' },
  2: { Icon: School, label: '등교 (2캠)' },
  3: { Icon: MapPin, label: '하교 (2캠)' },
}

const CAMPUS_META = {
  main:   { label: '본캠' },
  second: { label: '2캠' },
}

const campusOf = (dir) => (dir >= 2 ? 'second' : 'main')

function DirLabel({ direction }) {
  const meta = DIRECTION_META[direction]
  if (!meta) return <span>{direction}</span>
  const { Icon, label } = meta
  return <span className="flex items-center justify-center gap-1"><Icon size={13} /> {label}</span>
}

export default function ShuttleSheetContent({ initialDir = null }) {
  const { data: schedule, loading } = useShuttleSchedule()
  const directions = schedule?.directions ?? []

  const availableCampuses = useMemo(() => {
    const set = new Set(directions.map((d) => campusOf(d.direction)))
    const ordered = []
    if (set.has('main')) ordered.push('main')
    if (set.has('second')) ordered.push('second')
    return ordered
  }, [directions])

  const [activeCampus, setActiveCampus] = useState(
    initialDir != null ? campusOf(initialDir) : null
  )
  const [activeDir, setActiveDir] = useState(initialDir)

  const currentCampus = activeCampus ?? availableCampuses[0] ?? 'main'
  const campusDirs = directions.filter((d) => campusOf(d.direction) === currentCampus)
  const currentDirKey = (activeDir != null && campusDirs.some((d) => d.direction === activeDir))
    ? activeDir
    : campusDirs[0]?.direction ?? null
  const currentDir = campusDirs.find((d) => d.direction === currentDirKey)
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
      {availableCampuses.length > 1 && (
        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          {availableCampuses.map((key) => {
            const active = key === currentCampus
            return (
              <button
                key={key}
                onClick={() => { setActiveCampus(key); setActiveDir(null) }}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
                  ${active
                    ? 'text-navy dark:text-blue-400 border-navy dark:border-blue-400'
                    : 'text-slate-500 dark:text-slate-400 border-transparent'}`}
              >
                {CAMPUS_META[key].label}
              </button>
            )
          })}
        </div>
      )}
      {campusDirs.length > 0 && (
        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          {campusDirs.map(({ direction }) => {
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
                <DirLabel direction={direction} />
              </button>
            )
          })}
        </div>
      )}
      <ShuttleTimetable times={timeObjs} />
    </div>
  )
}
