// frontend/src/components/now/AltChip.jsx
import RouteBadge from './RouteBadge'

function fmt(d) {
  if (d.arrive_in_seconds != null) {
    const m = Math.round(d.arrive_in_seconds / 60)
    return m <= 0 ? '곧' : `${m}분`
  }
  return d.depart_at ?? '–'
}

export default function AltChip({ departure }) {
  return (
    <button
      className="shrink-0 w-[168px] text-left p-3 rounded-xl bg-white dark:bg-slate-900
                 border border-slate-200 dark:border-slate-800"
    >
      <div className="flex items-center gap-2">
        <RouteBadge routeNumber={departure.route_number} mode={departure.mode} size="sm" />
        <span className="ml-auto text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
          {fmt(departure)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
        {departure.origin_name || '–'} → {departure.destination_name || '–'}
      </div>
    </button>
  )
}
