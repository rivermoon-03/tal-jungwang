import { useState } from 'react'
import ShuttleCard from './ShuttleCard'
import BusCard from './BusCard'
import BottomSheet from './BottomSheet'
import ShuttleSheetContent from './ShuttleSheetContent'
import BusStationSheetContent from './BusStationSheetContent'
import BusTimetableDetail from '../bus/BusTimetableDetail'
import { useBusStations } from '../../hooks/useBus'

export default function TransitTab() {
  const [shuttleSheetOpen, setShuttleSheetOpen] = useState(false)
  const [stationSheetOpen, setStationSheetOpen] = useState(false)
  const [timetableRoute, setTimetableRoute] = useState(null)

  const { data: stationsData } = useBusStations()
  const stations = stationsData ?? []
  const [selectedStationId, setSelectedStationId] = useState(null)

  if (timetableRoute) {
    return (
      <BusTimetableDetail
        routeId={timetableRoute.routeId}
        routeNo={timetableRoute.routeNo}
        onBack={() => setTimetableRoute(null)}
      />
    )
  }

  function handleStationSelect(id) {
    setSelectedStationId(id)
    setStationSheetOpen(false)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6 flex flex-col gap-4">
        <ShuttleCard onOpenSheet={() => setShuttleSheetOpen(true)} />
        <BusCard
          onOpenStationSheet={() => setStationSheetOpen(true)}
          setTimetableRoute={setTimetableRoute}
        />
      </div>

      <BottomSheet
        open={shuttleSheetOpen}
        onClose={() => setShuttleSheetOpen(false)}
        title="셔틀버스 시간표"
      >
        <ShuttleSheetContent />
      </BottomSheet>

      <BottomSheet
        open={stationSheetOpen}
        onClose={() => setStationSheetOpen(false)}
        title="정류장 선택"
      >
        <BusStationSheetContent
          stations={stations}
          selectedId={selectedStationId}
          onSelect={handleStationSelect}
        />
      </BottomSheet>
    </div>
  )
}
