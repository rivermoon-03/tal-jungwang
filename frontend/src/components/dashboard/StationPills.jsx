import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import StationChips from '../ui/StationChips.jsx'
import {
  BUS_STATION_LABELS,
  getAllowedDirections,
  getBusStationDisplay,
} from './busStationConfig'

const SUBWAY_OPTIONS = ['정왕', '초지', '시흥시청']

const SHUTTLE_CAMPUS_OPTIONS = [
  { id: 'main',   label: '본캠' },
  { id: 'second', label: '2캠' },
]

/**
 * StationPills — 정류장/역/캠퍼스 칩 전용 행. 결함 #1/#14/#32/#9 리디자인으로
 * 등하교 방향 토글(rightAddon)을 완전히 제거했다 — 방향은 Dashboard.jsx의
 * BusDirectionRow가 별도 줄에서 SegmentedControl로 담당한다. 이 컴포넌트는
 * 이제 칩 행 하나만 그린다(다른 요소와 절대 겹치지 않음).
 *
 * ui/StationChips.jsx가 className을 받지 않아 이 파일에서 `.no-scrollbar`를
 * 직접 주입할 수 없다 — 칩 자체는 whitespace-nowrap이라 텍스트가 잘리지는
 * 않지만, 가로 스크롤바 자체를 숨기려면 StationChips에 className passthrough가
 * 필요하다(통합자에게 요청: ui/StationChips.jsx에 className prop 추가).
 */
export default function StationPills({ mode, value, onChange, options }) {
  const selectedBusStation    = useAppStore((s) => s.selectedBusStation)
  const selectedShuttleCampus = useAppStore((s) => s.selectedShuttleCampus)
  const setBusStation         = useAppStore((s) => s.setBusStation)
  const setSubwayStation      = useAppStore((s) => s.setSubwayStation)
  const setShuttleCampus      = useAppStore((s) => s.setShuttleCampus)
  const { direction: effectiveDirection } = useEffectiveDirection()

  if (mode === 'taxi') return null

  if (mode === 'shuttle') {
    const rawItems = options ?? SHUTTLE_CAMPUS_OPTIONS
    const campusValue = value ?? selectedShuttleCampus

    const handleSelectCampus = (id) => {
      setShuttleCampus(id)
      if (typeof onChange === 'function') onChange(id)
    }

    return (
      <div
        role="group"
        aria-label="캠퍼스 선택"
        className="px-4 pb-1.5"
      >
        <StationChips
          variant="station"
          items={rawItems}
          active={campusValue}
          onChange={handleSelectCampus}
        />
      </div>
    )
  }

  if (mode === 'bus') {
    const allLabels = options ?? BUS_STATION_LABELS
    // 현재 방향에 맞는 정류장만 표시
    const filteredLabels = allLabels.filter((label) =>
      getAllowedDirections(label).includes(effectiveDirection)
    )
    const rawValue = value ?? selectedBusStation
    // 현재 방향에 허용되지 않는 정류장이 선택돼 있으면 첫 번째 허용 정류장으로 표시 보정
    // (useBusStationAutoSelect가 store를 곧 업데이트하므로 순간적 불일치 방지용)
    const stationValue = filteredLabels.includes(rawValue)
      ? rawValue
      : (filteredLabels[0] ?? rawValue)
    const stationItems = filteredLabels.map((label) => ({
      id: label,
      label: getBusStationDisplay(label),
    }))

    const handleSelectStation = (id) => {
      setBusStation(id)
      if (typeof onChange === 'function') onChange(id)
    }

    return (
      <div
        role="group"
        aria-label="정류장 선택"
        className="px-4 pb-1.5"
      >
        <StationChips
          variant="station"
          items={stationItems}
          active={stationValue}
          onChange={handleSelectStation}
        />
      </div>
    )
  }

  // subway
  const rawItems = options ?? SUBWAY_OPTIONS
  if (rawItems.length === 0) return null

  const subwayItems = rawItems.map((label) => ({ id: label, label }))

  const handleSelect = (id) => {
    setSubwayStation(id)
    if (typeof onChange === 'function') onChange(id)
  }

  return (
    <div
      role="group"
      aria-label="역 선택"
      className="px-4 pb-1.5"
    >
      <StationChips
        variant="station"
        items={subwayItems}
        active={value}
        onChange={handleSelect}
      />
    </div>
  )
}
