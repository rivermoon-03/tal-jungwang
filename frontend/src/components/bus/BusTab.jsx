import { useState, useEffect } from 'react'
import { BusFront, RefreshCw } from 'lucide-react'
import { useBusStations, useBusArrivals } from '../../hooks/useBus'
import StationList from './StationList'
import ArrivalList from './ArrivalList'
import BusTimetableDetail from './BusTimetableDetail'

export default function BusTab() {
  const { data: stationsData, loading: stationsLoading } = useBusStations()
  const stations = stationsData ?? []
  const [selectedId, setSelectedId] = useState(null)
  const [timetableRoute, setTimetableRoute] = useState(null) // { routeId, routeNo }

  useEffect(() => {
    if (!selectedId && stations.length > 0) {
      setSelectedId(stations[0].station_id)
    }
  }, [selectedId, stations])

  const { data: arrivals, loading: arrivalsLoading, refetch } = useBusArrivals(selectedId)

  const timeStr = arrivals?.updated_at
    ? new Date(arrivals.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--'

  // ── 시간표 상세 뷰 ────────────────────────────────────────
  if (timetableRoute) {
    return (
      <BusTimetableDetail
        routeId={timetableRoute.routeId}
        routeNo={timetableRoute.routeNo}
        onBack={() => setTimetableRoute(null)}
      />
    )
  }

  // ── 메인 뷰 ──────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <BusFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">버스</h2>
        <span className="ml-auto text-sm opacity-75">갱신: {timeStr}</span>
        <button onClick={refetch} className="opacity-75 hover:opacity-100 p-1" aria-label="새로고침">
          <RefreshCw size={16} />
        </button>
      </div>

      {stationsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">정류장 불러오는 중...</p>
        </div>
      ) : (
        <>
          <StationList
            stations={stations}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setTimetableRoute(null) }}
          />
          {arrivalsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-base text-slate-400">도착 정보 불러오는 중...</p>
            </div>
          ) : (
            <ArrivalList
              arrivals={arrivals?.arrivals ?? []}
              onTimetableClick={(routeId, routeNo) => setTimetableRoute({ routeId, routeNo })}
            />
          )}
        </>
      )}
    </div>
  )
}
