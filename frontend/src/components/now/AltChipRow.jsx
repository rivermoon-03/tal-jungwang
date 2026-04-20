// frontend/src/components/now/AltChipRow.jsx
import AltChip from './AltChip'

export default function AltChipRow({ departures }) {
  if (!departures || departures.length === 0) return null
  return (
    <section className="mt-4">
      <h3 className="px-5 mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        다른 교통편
      </h3>
      <div className="px-5 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {departures.map((d, i) => (
          <AltChip key={`${d.source}-${d.route_number}-${i}`} departure={d} />
        ))}
      </div>
    </section>
  )
}
