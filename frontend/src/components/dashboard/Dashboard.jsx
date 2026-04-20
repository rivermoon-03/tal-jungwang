import useAppStore from '../../stores/useAppStore'
import ModeTabs from './ModeTabs'
import StationPills from './StationPills'
import BusPanel from '../summary/BusPanel'
import SubwayPanel from '../summary/SubwayPanel'
import ShuttlePanel from '../summary/ShuttlePanel'

/**
 * Dashboard — 스냅 하단 영역. 모드 탭 + 정류장 pill + 활성 패널 렌더.
 *
 * 스토어에서 selectedMode만 구독한다. 패널들은 자체적으로
 * selectedBusStation/selectedBusDirection / selectedSubwayStation 등을 구독한다.
 *
 * 높이는 부모(MainShell)가 제어하므로 자체적으로 overflow-auto 한다.
 */
export default function Dashboard() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const selectedSubwayStation = useAppStore((s) => s.selectedSubwayStation)

  let stationValue = null
  if (selectedMode === 'bus') {
    stationValue = selectedBusStation
  } else if (selectedMode === 'subway') {
    stationValue = selectedSubwayStation
  }

  return (
    <section
      className="h-full overflow-auto bg-white dark:bg-surface-dark"
      aria-label="대시보드"
    >
      <ModeTabs />

      {selectedMode !== 'shuttle' ? (
        <StationPills mode={selectedMode} value={stationValue} />
      ) : null}

      <div className="px-4 pb-6">
        {selectedMode === 'bus' && <BusPanel />}
        {selectedMode === 'subway' && <SubwayPanel />}
        {selectedMode === 'shuttle' && <ShuttlePanel />}
      </div>
    </section>
  )
}
