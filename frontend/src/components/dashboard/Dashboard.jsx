import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import useBusStationAutoSelect from '../../hooks/useBusStationAutoSelect'
import ModeTabs from './ModeTabs'
import StationPills from './StationPills'
import BusPanel from '../summary/BusPanel'
import SubwayPanel from '../summary/SubwayPanel'
import ShuttlePanel from '../summary/ShuttlePanel'
import TaxiPanel from '../summary/TaxiPanel'
import StationChips from '../ui/StationChips.jsx'
import { BUS_STATION_LABELS, getAllowedDirections } from './busStationConfig'

/**
 * Dashboard — 스냅 하단 영역. 모드 탭 + 정류장 chip + 활성 패널 렌더.
 *
 * 스토어에서 selectedMode만 구독한다. 패널들은 자체적으로
 * selectedBusStation/selectedBusDirection / selectedSubwayStation 등을 구독한다.
 *
 * 높이는 부모(MainShell)가 제어하므로 자체적으로 overflow-auto 한다.
 */
const DIRECTION_ITEMS = [
  { id: '등교', label: '등교' },
  { id: '하교', label: '하교' },
]

function DirectionToggle() {
  const { direction } = useEffectiveDirection()
  const selectedBusStation  = useAppStore((s) => s.selectedBusStation)
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const setBusStation        = useAppStore((s) => s.setBusStation)

  function handleSelect(id) {
    setDirectionOverride(id)
    // 현재 정류장이 새 방향을 허용하지 않으면 해당 방향의 첫 번째 정류장으로 이동
    if (!getAllowedDirections(selectedBusStation).includes(id)) {
      const next = BUS_STATION_LABELS.find((s) => getAllowedDirections(s).includes(id))
      if (next) setBusStation(next)
    }
  }

  return (
    <div className="shrink-0">
      <StationChips
        variant="direction"
        items={DIRECTION_ITEMS}
        active={direction}
        onChange={handleSelect}
      />
    </div>
  )
}

export default function Dashboard() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const selectedSubwayStation = useAppStore((s) => s.selectedSubwayStation)
  const selectedShuttleCampus = useAppStore((s) => s.selectedShuttleCampus)

  // 방향-정류장 정합 보정 + GPS 최근접 자동 선택
  useBusStationAutoSelect()

  const scrollRef = useRef(null)
  const savedScroll = useAppStore((s) => s.dashboardScrollTop)
  const setSavedScroll = useAppStore((s) => s.setDashboardScrollTop)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = savedScroll
    // Only restore once on mount; avoid re-triggering on every savedScroll change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      ref={scrollRef}
      onScroll={(e) => setSavedScroll(e.currentTarget.scrollTop)}
      className="h-full overflow-auto bg-bg dark:bg-bg"
      aria-label="대시보드"
    >
      <ModeTabs />

      <StationPills
        mode={selectedMode}
        value={stationValue}
        rightAddon={selectedMode === 'bus' ? <DirectionToggle /> : null}
      />

      <div className="px-4 pb-6">
        {selectedMode === 'bus' && (
          <div key="bus" className="animate-fade-in"><BusPanel /></div>
        )}
        {selectedMode === 'subway' && (
          <div key="subway" className="animate-fade-in"><SubwayPanel dataMode="timetable" /></div>
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
