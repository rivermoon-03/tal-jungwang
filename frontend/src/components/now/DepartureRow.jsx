// frontend/src/components/now/DepartureRow.jsx
import RouteBadge    from './RouteBadge'
import RealtimeBadge from './RealtimeBadge'
import SeatBadge     from './SeatBadge'

function fmt(d) {
  if (d.arrive_in_seconds != null) {
    const m = Math.round(d.arrive_in_seconds / 60)
    return m <= 0 ? '곧' : `${m}분`
  }
  return d.depart_at ?? '–'
}

export default function DepartureRow({ departure, onClick }) {
  const d = departure
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 last:border-b-0"
    >
      <RouteBadge routeNumber={d.route_number} mode={d.mode} size="sm" />
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {d.origin_name || '–'} → {d.destination_name || '–'}
          </span>
          {d.is_realtime && <RealtimeBadge />}
          {d.crowded > 0 && <SeatBadge level={d.crowded} />}
        </div>
      </div>
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
        {fmt(d)}
      </span>
    </button>
  )
}
