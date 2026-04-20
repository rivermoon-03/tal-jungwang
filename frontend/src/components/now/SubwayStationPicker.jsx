// frontend/src/components/now/SubwayStationPicker.jsx
import useAppStore from '../../stores/useAppStore'

const STATIONS = ['정왕', '초지', '시흥시청']

export default function SubwayStationPicker() {
  const current = useAppStore((s) => s.selectedSubwayStation)
  const setStation = useAppStore((s) => s.setSubwayStation)
  return (
    <div role="radiogroup" aria-label="지하철역" className="mx-5 mb-2 flex gap-2">
      {STATIONS.map((s) => {
        const active = s === current
        return (
          <button
            key={s}
            role="radio"
            aria-checked={active}
            onClick={() => setStation(s)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-colors ${
              active
                ? 'bg-amber-400 text-slate-900 dark:bg-amber-300 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
            }`}
          >
            {s}역
          </button>
        )
      })}
    </div>
  )
}
