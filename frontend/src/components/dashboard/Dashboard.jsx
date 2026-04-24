import { useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import useUserLocation, { getNearestStation } from '../../hooks/useUserLocation'
import ModeTabs from './ModeTabs'
import StationPills from './StationPills'
import BusPanel from '../summary/BusPanel'
import SubwayPanel from '../summary/SubwayPanel'
import ShuttlePanel from '../summary/ShuttlePanel'
import TaxiPanel from '../summary/TaxiPanel'
import { BUS_STATION_LABELS, getAllowedDirections, getDefaultDirection } from './busStationConfig'

/**
 * Dashboard — 스냅 하단 영역. 모드 탭 + 정류장 pill + 활성 패널 렌더.
 *
 * 스토어에서 selectedMode만 구독한다. 패널들은 자체적으로
 * selectedBusStation/selectedBusDirection / selectedSubwayStation 등을 구독한다.
 *
 * 높이는 부모(MainShell)가 제어하므로 자체적으로 overflow-auto 한다.
 */
function DirectionToggle() {
  const { direction } = useEffectiveDirection()
  const selectedBusStation  = useAppStore((s) => s.selectedBusStation)
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const setBusStation        = useAppStore((s) => s.setBusStation)

  function handleSelect(full) {
    setDirectionOverride(full)
    // 현재 정류장이 새 방향을 허용하지 않으면 해당 방향의 첫 번째 정류장으로 이동
    if (!getAllowedDirections(selectedBusStation).includes(full)) {
      const next = BUS_STATION_LABELS.find((s) => getAllowedDirections(s).includes(full))
      if (next) setBusStation(next)
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {['등', '하'].map((short) => {
        const full = short === '등' ? '등교' : '하교'
        const active = direction === full
        return (
          <button
            key={short}
            type="button"
            onClick={() => handleSelect(full)}
            className={`w-8 h-8 rounded-full text-sm font-bold leading-none transition-colors pressable
              ${active
                ? 'bg-navy text-white dark:bg-blue-600'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const selectedSubwayStation = useAppStore((s) => s.selectedSubwayStation)
  const selectedShuttleCampus = useAppStore((s) => s.selectedShuttleCampus)

  const coords = useUserLocation()
  const hasAutoSelected = useAppStore((s) => s.hasAutoSelectedStation)
  const setHasAutoSelected = useAppStore((s) => s.setHasAutoSelectedStation)
  const setBusStation = useAppStore((s) => s.setBusStation)

  useEffect(() => {
    if (!coords || hasAutoSelected) return
    const nearest = getNearestStation(coords[0], coords[1])
    if (nearest) setBusStation(nearest)
    setHasAutoSelected(true)
  }, [coords, hasAutoSelected, setBusStation, setHasAutoSelected])

  let stationValue = null
  if (selectedMode === 'bus') {
    stationValue = selectedBusStation
  } else if (selectedMode === 'subway') {
    stationValue = selectedSubwayStation
  } else if (selectedMode === 'shuttle') {
    stationValue = selectedShuttleCampus
  } else if (selectedMode === 'taxi') {
    stationValue = null
  }

  return (
    <section
      className="h-full overflow-auto bg-white dark:bg-surface-dark"
      aria-label="대시보드"
    >
      <ModeTabs rightAddon={selectedMode === 'bus' ? <DirectionToggle /> : null} />

      <StationPills mode={selectedMode} value={stationValue} />

      <div className="px-4 pb-6">
        {selectedMode === 'bus' && (
          <div key="bus" className="animate-fade-in"><BusPanel /></div>
        )}
        {selectedMode === 'subway' && (
          <div key="subway" className="animate-fade-in"><SubwayPanel /></div>
        )}
        {selectedMode === 'shuttle' && (
          <div key="shuttle" className="animate-fade-in"><ShuttlePanel /></div>
        )}
        {selectedMode === 'taxi' && (
          <div key="taxi" className="animate-fade-in"><TaxiPanel /></div>
        )}
      </div>
    </section>
  )
}
