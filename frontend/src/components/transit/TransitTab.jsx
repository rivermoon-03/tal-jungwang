import { useState } from 'react'
import { Bus } from 'lucide-react'
import ShuttleCard from './ShuttleCard'
import BusCard from './BusCard'
import BottomSheet from './BottomSheet'
import ShuttleSheetContent from './ShuttleSheetContent'
import BusTimetableDetail from '../bus/BusTimetableDetail'
import useAppStore from '../../stores/useAppStore'

export default function TransitTab() {
  const [shuttleSheetOpen, setShuttleSheetOpen] = useState(false)
  const [shuttleInitDir, setShuttleInitDir] = useState(null)
  const [shuttleSheetKey, setShuttleSheetKey] = useState(0)
  const [timetableRoute, setTimetableRoute] = useState(null)
  const setSheetOpen = useAppStore((s) => s.setSheetOpen)

  if (timetableRoute) {
    return (
      <BusTimetableDetail
        routeId={timetableRoute.routeId}
        routeNo={timetableRoute.routeNo}
        destination={timetableRoute.destination}
        stationId={timetableRoute.stationId}
        onBack={() => setTimetableRoute(null)}
      />
    )
  }

  function openShuttleSheet(dir = null) {
    setShuttleInitDir(dir)
    setShuttleSheetKey((k) => k + 1)
    setShuttleSheetOpen(true)
    setSheetOpen(true)
  }

  function closeShuttleSheet() {
    setShuttleSheetOpen(false)
    setSheetOpen(false)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <Bus size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">교통</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6 flex flex-col gap-4">
        <ShuttleCard onOpenSheet={openShuttleSheet} />
        <BusCard setTimetableRoute={setTimetableRoute} />
      </div>

      <BottomSheet
        open={shuttleSheetOpen}
        onClose={closeShuttleSheet}
        title="셔틀버스 시간표"
      >
        <ShuttleSheetContent key={shuttleSheetKey} initialDir={shuttleInitDir} />
      </BottomSheet>
    </div>
  )
}
