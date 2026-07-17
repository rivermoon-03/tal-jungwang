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
    <div className="bg-surface dark:bg-surface rounded-card overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-line dark:border-line">
        <div className="flex items-center gap-2.5">
          <BusFront size={18} strokeWidth={2} className="text-ink dark:text-ink" />
          <span className="text-[15px] font-semibold text-ink dark:text-ink tracking-tight">공공버스</span>
          <span className="text-meta font-semibold text-chip-blue-fg dark:text-chip-blue-fg bg-chip-blue-bg dark:bg-chip-blue-bg px-2 py-0.5 rounded-full tracking-wide">실시간</span>
        </div>
        <div className="flex items-center gap-2.5">
          {arrivals?.updated_at && (
            <span className="text-meta font-semibold text-mute dark:text-mute tabular-nums">{secondsAgo}초 전 갱신</span>
          )}
          <button
            onClick={refetch}
            aria-label="새로고침"
            className="w-8 h-8 rounded-mini bg-line dark:bg-line text-ink-2 dark:text-ink-2 hover:bg-line-strong/30 dark:hover:bg-line-strong/30 flex items-center justify-center transition-colors pressable"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {!stationsLoading && stations.length > 0 && (
        <div className="flex gap-1.5 px-4 py-3 border-b border-line dark:border-line overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {stations.map((s) => (
            <button
              key={s.station_id}
              onClick={() => setSelectedId(s.station_id)}
              className={`flex-shrink-0 text-[13px] rounded-full px-4 py-2 transition-colors tracking-tight
                ${s.station_id === selectedId
                  ? 'bg-ink text-white dark:bg-accent dark:text-ink font-semibold'
                  : 'bg-surface-2 dark:bg-bg text-ink-2 dark:text-ink-2 font-bold'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {arrivalsLoading ? (
        <div className="py-6 text-center text-meta font-semibold text-mute dark:text-mute">도착 정보 불러오는 중...</div>
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
