// frontend/src/components/now/DestinationPicker.jsx
import useAppStore from '../../stores/useAppStore'
import { useDestinations } from '../../hooks/useDestinations'

export default function DestinationPicker() {
  const { data } = useDestinations()
  const code    = useAppStore((s) => s.selectedDestinationCode)
  const setCode = useAppStore((s) => s.setDestinationCode)
  const list    = Array.isArray(data) ? data : []

  return (
    <div
      role="radiogroup"
      aria-label="하교 목적지"
      className="mx-5 mb-2 flex gap-2 overflow-x-auto scrollbar-hide"
    >
      {list.map((d) => {
        const active = d.code === code
        return (
          <button
            key={d.code}
            role="radio"
            aria-checked={active}
            onClick={() => setCode(d.code)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              active
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
            }`}
          >
            {d.name}
          </button>
        )
      })}
    </div>
  )
}
