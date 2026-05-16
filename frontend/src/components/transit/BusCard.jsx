import { useState, useEffect } from 'react'
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

  const { data: arrivals, loading: arrivalsLoading, refetch } = useBusArrivals(selectedId)

  // 마지막 폴링 시각 기반 상대 시각 ("N초 전")
  const [secondsAgo, setSecondsAgo] = useState(0)
  useEffect(() => {
    if (!arrivals?.updated_at) return
    const ms = new Date(arrivals.updated_at).getTime()
    if (Number.isNaN(ms)) return
    const tick = () => setSecondsAgo(Math.max(0, Math.floor((Date.now() - ms) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [arrivals?.updated_at])

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-card overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-line dark:border-line-dark">
        <div className="flex items-center gap-2.5">
          <BusFront size={18} strokeWidth={2} className="text-ink dark:text-ink-dark" />
          <span className="text-[15px] font-black text-ink dark:text-ink-dark tracking-tight">공공버스</span>
          <span className="text-meta font-extrabold text-chip-blue-fg dark:text-chip-blue-fg-dark bg-chip-blue-bg dark:bg-chip-blue-bg-dark px-2 py-0.5 rounded-full tracking-wide">실시간</span>
        </div>
        <div className="flex items-center gap-2.5">
          {arrivals?.updated_at && (
            <span className="text-meta font-semibold text-mute dark:text-mute-dark tabular-nums">{secondsAgo}초 전 갱신</span>
          )}
          <button
            onClick={refetch}
            aria-label="새로고침"
            className="w-8 h-8 rounded-mini bg-line dark:bg-line-dark text-text dark:text-text-dark hover:bg-mute-2/30 dark:hover:bg-mute-2-dark/30 flex items-center justify-center transition-colors pressable"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {!stationsLoading && stations.length > 0 && (
        <div className="flex gap-1.5 px-4 py-3 border-b border-line dark:border-line-dark overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {stations.map((s) => (
            <button
              key={s.station_id}
              onClick={() => setSelectedId(s.station_id)}
              className={`flex-shrink-0 text-[13px] rounded-full px-4 py-2 transition-colors tracking-tight
                ${s.station_id === selectedId
                  ? 'bg-ink text-white dark:bg-accent-dark dark:text-ink font-black'
                  : 'bg-surface-alt dark:bg-surface-dark-alt text-text dark:text-text-dark font-bold'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {arrivalsLoading ? (
        <div className="py-6 text-center text-meta font-semibold text-mute dark:text-mute-dark">도착 정보 불러오는 중...</div>
      ) : (
        <ArrivalList
          arrivals={arrivals?.arrivals ?? []}
          stationId={selectedId}
          stationLabel={selectedStation?.name}
          direction={direction}
          onTimetableClick={(routeId, routeNo, destination) => setTimetableRoute({ routeId, routeNo, destination, stationId: selectedId })}
        />
      )}
    </div>
  )
}
