export default function StationList({ stations, selectedId, onSelect }) {
  return (
    <div className="bg-white border-b border-slate-200">
      {stations.map((station) => {
        const isSelected = station.station_id === selectedId
        return (
          <button
            key={station.station_id}
            onClick={() => onSelect(station.station_id)}
            className={`flex w-full items-center justify-between px-5 py-3
              border-b border-slate-100 text-left border-l-4 min-h-[48px]
              ${isSelected ? 'bg-blue-50 border-l-navy pl-4' : 'border-l-transparent hover:bg-slate-50'}`}
          >
            <span className={`text-base font-semibold ${isSelected ? 'text-navy' : 'text-slate-800'}`}>
              {station.name}
            </span>
            <span className="text-sm text-slate-400">{station.routes.length}개 노선</span>
          </button>
        )
      })}
    </div>
  )
}
