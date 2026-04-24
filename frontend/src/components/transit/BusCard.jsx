import { useState, useEffect, useMemo } from 'react'
import { BusFront, RefreshCw } from 'lucide-react'
import { useBusStations, useBusArrivals } from '../../hooks/useBus'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import ArrivalList from '../bus/ArrivalList'

export default function BusCard({ setTimetableRoute }) {
  const { data: stationsData, loading: stationsLoading } = useBusStations()
  const stations = stationsData ?? []
  const [selectedId, setSelectedId] = useState(null)
  const { direction } = useEffectiveDirection()
  const selectedStation = stations.find((s) => s.station_id === selectedId)

  useEffect(() => {
    if (!selectedId && stations.length > 0) {
      setSelectedId(stations[0].station_id)
    }
  }, [selectedId, stations])

  const { data: arrivals, loading: arrivalsLoading, fetchedAt, refetch } = useBusArrivals(selectedId)

  const adjustedArrivals = useMemo(() => {
    if (!arrivals?.arrivals || !fetchedAt) return arrivals
    const elapsedSec = (Date.now() - fetchedAt) / 1000
    return {
      ...arrivals,
      arrivals: arrivals.arrivals.map((a) =>
        a.arrival_type === 'realtime'
          ? { ...a, arrive_in_seconds: Math.max(0, a.arrive_in_seconds - elapsedSec) }
          : a
      ),
    }
  }, [arrivals, fetchedAt])

  const timeStr = arrivals?.updated_at
    ? new Date(arrivals.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--'

  return (
    <div className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden border border-slate-200 dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <BusFront size={16} strokeWidth={2} className="text-navy dark:text-blue-400" />
          <span className="text-sm font-bold text-navy dark:text-blue-300">공공버스</span>
          <span className="text-xs text-slate-400">갱신 {timeStr}</span>
        </div>
        <button onClick={refetch} aria-label="새로고침" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {!stationsLoading && stations.length > 0 && (
        <div className="flex gap-2 px-4 py-3 border-b border-slate-100 dark:border-border-dark overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {stations.map((s) => (
            <button
              key={s.station_id}
              onClick={() => setSelectedId(s.station_id)}
              className={`flex-shrink-0 text-sm font-semibold rounded-full px-4 py-2 transition-colors
                ${s.station_id === selectedId
                  ? 'bg-navy text-white dark:bg-blue-600'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {arrivalsLoading ? (
        <div className="py-6 text-center text-slate-400 text-sm">도착 정보 불러오는 중...</div>
      ) : (
        <ArrivalList
          arrivals={adjustedArrivals?.arrivals ?? []}
          stationId={selectedId}
          stationLabel={selectedStation?.name}
          direction={direction}
          onTimetableClick={(routeId, routeNo, destination) => setTimetableRoute({ routeId, routeNo, destination, stationId: selectedId })}
        />
      )}
    </div>
  )
}
