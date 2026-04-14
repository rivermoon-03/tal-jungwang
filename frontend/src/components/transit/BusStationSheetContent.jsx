export default function BusStationSheetContent({ stations, selectedId, onSelect }) {
  return (
    <ul className="overflow-y-auto h-full">
      {stations.map((station) => {
        const isSelected = station.station_id === selectedId
        return (
          <li key={station.station_id}>
            <button
              onClick={() => onSelect(station.station_id)}
              className={`flex w-full items-center justify-between px-5 py-4
                border-b border-slate-100 dark:border-slate-800 text-left
                border-l-4 transition-colors
                ${isSelected
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-l-navy'
                  : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <div>
                <p className={`font-semibold text-base ${isSelected ? 'text-navy dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {station.name}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {station.routes?.length ?? 0}개 노선
                </p>
              </div>
              {isSelected && (
                <span className="text-xs font-bold text-navy dark:text-blue-400 border border-navy dark:border-blue-400 rounded px-2 py-1">
                  선택됨
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
