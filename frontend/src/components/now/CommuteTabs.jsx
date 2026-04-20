// frontend/src/components/now/CommuteTabs.jsx
import { School, Home, TrainFront } from 'lucide-react'
import { useCommuteMode } from '../../hooks/useCommuteMode'

const TABS = [
  { id: '등교',   Icon: School     },
  { id: '하교',   Icon: Home       },
  { id: '지하철', Icon: TrainFront },
]

export default function CommuteTabs() {
  const { mode, isAuto, autoMode, setMode } = useCommuteMode()
  return (
    <div
      role="tablist"
      aria-label="출발 방향"
      className="mx-5 my-2 grid grid-cols-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 p-1"
    >
      {TABS.map(({ id, Icon }) => {
        const active = mode === id
        const showAuto = active && isAuto && autoMode === id
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => setMode(id)}
            className={`relative flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-colors ${
              active
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
            <span>{id}</span>
            {showAuto && (
              <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                자동
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
