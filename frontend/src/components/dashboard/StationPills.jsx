import useAppStore from '../../stores/useAppStore'
import SegmentTabs from '../common/SegmentTabs.jsx'
import {
  BUS_STATION_LABELS,
  BUS_DIRECTION_LABELS,
  getAllowedDirections,
  getDefaultDirection,
} from './busStationConfig'

/**
 * StationPills — 모드 탭 아래 정류장/역 선택 pill 행.
 * 버스 모드는 3개 정류장(한국공학대/시화터미널/이마트) pill + 방향(등교/하교) 탭.
 * 지하철 모드는 기존 역 pill.
 */
const SUBWAY_OPTIONS = ['정왕', '초지', '시흥시청']

export default function StationPills({ mode, value, onChange, options }) {
  const selectedBusStation    = useAppStore((s) => s.selectedBusStation)
  const selectedBusDirection  = useAppStore((s) => s.selectedBusDirection)
  const setBusStation         = useAppStore((s) => s.setBusStation)
  const setBusDirection       = useAppStore((s) => s.setBusDirection)
  const setSubwayStation      = useAppStore((s) => s.setSubwayStation)

  if (mode === 'shuttle') return null

  if (mode === 'bus') {
    const items = options ?? BUS_STATION_LABELS
    const stationValue = value ?? selectedBusStation
    const allowed = getAllowedDirections(stationValue)

    const handleSelectStation = (label) => {
      setBusStation(label)
      const nextAllowed = getAllowedDirections(label)
      if (!nextAllowed.includes(selectedBusDirection)) {
        setBusDirection(getDefaultDirection(label))
      }
      if (typeof onChange === 'function') onChange(label)
    }

    const directionTabs = BUS_DIRECTION_LABELS.map((dir) => ({
      id: dir,
      label: dir,
      disabled: !allowed.includes(dir),
    }))

    return (
      <>
        <div
          role="group"
          aria-label="정류장 선택"
          className="flex gap-1.5 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
        >
          {items.map((label) => (
            <StationPillButton
              key={label}
              label={label}
              active={stationValue === label}
              onClick={() => handleSelectStation(label)}
            />
          ))}
        </div>
        <div aria-label="방향 선택" className="px-4 pb-1.5">
          <SegmentTabs
            tabs={directionTabs}
            active={selectedBusDirection}
            onChange={setBusDirection}
            size="sm"
          />
        </div>
      </>
    )
  }

  // subway
  const items = options ?? SUBWAY_OPTIONS
  if (items.length === 0) return null

  const handleSelect = (label) => {
    setSubwayStation(label)
    if (typeof onChange === 'function') onChange(label)
  }

  return (
    <div
      role="group"
      aria-label="역 선택"
      className="flex gap-1.5 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
    >
      {items.map((label) => (
        <StationPillButton
          key={label}
          label={label}
          active={value === label}
          onClick={() => handleSelect(label)}
        />
      ))}
    </div>
  )
}

function StationPillButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="pressable whitespace-nowrap"
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        border: active
          ? '1.5px solid var(--tj-pill-active-bg)'
          : '1.5px solid var(--tj-line)',
        background: active ? 'var(--tj-pill-active-bg)' : 'transparent',
        color: active ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.2,
        cursor: 'pointer',
        transition: 'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
      }}
    >
      {label}
    </button>
  )
}
