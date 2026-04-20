// frontend/src/components/now/HeroNextDeparture.jsx
import RouteBadge    from './RouteBadge'
import RealtimeBadge from './RealtimeBadge'
import SeatBadge     from './SeatBadge'

function minutesText(dep) {
  if (dep.arrive_in_seconds != null) {
    const m = Math.max(0, Math.round(dep.arrive_in_seconds / 60))
    return m === 0 ? '곧 도착' : `${m}분`
  }
  if (dep.depart_at) return dep.depart_at
  return '–'
}

export default function HeroNextDeparture({ departure }) {
  if (!departure) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500">
        지금 운행 중인 노선이 없어요.
      </div>
    )
  }
  const d = departure
  return (
    <article className="p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
      <header className="flex items-center gap-2">
        <RouteBadge routeNumber={d.route_number} mode={d.mode} />
        {d.is_realtime && <RealtimeBadge />}
        {d.crowded > 0 && <SeatBadge level={d.crowded} />}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 truncate">
          {d.route_name || d.destination_name || ''}
        </span>
      </header>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className="font-sans tabular-nums text-slate-900 dark:text-slate-100"
          style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          {minutesText(d)}
        </span>
      </div>

      <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {d.board_stop_name ? `${d.board_stop_name}에서 탑승` : null}
      </div>
    </article>
  )
}
