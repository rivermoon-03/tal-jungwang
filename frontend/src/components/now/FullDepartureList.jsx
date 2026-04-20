// frontend/src/components/now/FullDepartureList.jsx
import DepartureRow from './DepartureRow'

export default function FullDepartureList({ departures, onRowClick }) {
  if (!departures || departures.length === 0) {
    return (
      <section className="p-6 text-center text-slate-500 dark:text-slate-400">
        출발 정보가 없어요.
      </section>
    )
  }
  return (
    <section className="mt-6">
      <h3 className="px-5 mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        전체 출발
      </h3>
      <div className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        {departures.map((d, i) => (
          <DepartureRow
            key={`${d.source}-${d.route_number}-${i}`}
            departure={d}
            onClick={() => onRowClick?.(d)}
          />
        ))}
      </div>
    </section>
  )
}
