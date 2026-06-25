import { useEffect, useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import useUserLocation, { getNearestStationInfo } from '../../hooks/useUserLocation'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'

// 지도(UserLocationMarker)가 watchPosition으로 store에 채워주는 좌표를 1차로 사용.
// 지도가 마운트되기 전 잠시 비어있을 수 있으므로, useUserLocation을 fallback으로.
function useUserCoords() {
  const stored = useAppStore((s) => s.userLocation) // { lat, lng } | null
  const fallback = useUserLocation()                 // [lat, lng] | null
  if (stored?.lat != null && stored?.lng != null) return [stored.lat, stored.lng]
  return fallback
}
import {
  BUS_STATION_LABELS,
  getAllowedDirections,
  getBusStationDisplay,
} from './busStationConfig'

// PC 전용 정류장 picker. 미니맵 없이 텍스트·칩만으로 깔끔하게.
// - 헤더 카드: 현재 정류장 + GPS 자동/거리 + 등교/하교 토글
// - 그 아래 horizontal chip row: 자동/한국공학대/시화터미널/…
// - 모바일에는 노출 안 됨 (caller가 PCMapDashboard 안에서만 렌더)

export default function PCStationPicker() {
  const selectedBusStation   = useAppStore((s) => s.selectedBusStation)
  const setBusStation        = useAppStore((s) => s.setBusStation)
  const autoMode             = useAppStore((s) => s.busStationAutoMode)
  const setAutoMode          = useAppStore((s) => s.setBusStationAutoMode)
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const { direction } = useEffectiveDirection()
  const coords = useUserCoords()

  // 현재 방향에 허용되는 정류장만 칩으로 표시
  const allowedStations = useMemo(
    () => BUS_STATION_LABELS.filter((s) => getAllowedDirections(s).includes(direction)),
    [direction],
  )

  // GPS 자동 → 가장 가까운 정류장
  const nearestInfo = useMemo(() => {
    if (!coords) return null
    return getNearestStationInfo(coords[0], coords[1], allowedStations)
  }, [coords, allowedStations])

  // auto 모드일 때 nearest로 자동 동기화
  useEffect(() => {
    if (!autoMode) return
    if (!nearestInfo) return
    if (nearestInfo.name === selectedBusStation) return
    setBusStation(nearestInfo.name)
  }, [autoMode, nearestInfo, selectedBusStation, setBusStation])

  const handlePickStation = (label) => {
    if (label === '자동') {
      setAutoMode(true)
      if (nearestInfo) setBusStation(nearestInfo.name)
      return
    }
    if (!allowedStations.includes(label)) {
      const next = BUS_STATION_LABELS.find((s) => getAllowedDirections(s).includes(direction))
      if (next) setBusStation(next)
    } else {
      setBusStation(label)
    }
    setAutoMode(false)
  }

  const handleDirection = (dir) => setDirectionOverride(dir)

  const distLabel = nearestInfo
    ? (nearestInfo.distanceM < 1000
        ? `${nearestInfo.distanceM}m`
        : `${(nearestInfo.distanceM / 1000).toFixed(1)}km`)
    : null

  const stationLabel = getBusStationDisplay(selectedBusStation) || selectedBusStation
  const statusLabel = autoMode
    ? (coords ? `자동${distLabel ? ' · ' + distLabel : ''}` : 'GPS 대기 중')
    : '수동'

  return (
    <div className="px-4 pt-4 pb-2">
      {/* 헤더 — 카드 없이 텍스트만 */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-caption font-extrabold text-accent leading-none">
            {statusLabel}
          </div>
          <div className="text-[22px] font-black text-ink dark:text-white tracking-[-0.03em] leading-tight mt-1.5 truncate">
            {stationLabel}
          </div>
          <div className="text-label font-semibold text-mute dark:text-mute-dark mt-1">
            {autoMode ? '가장 가까운 정류장' : '수동 선택됨'}
          </div>
        </div>
        <DirectionToggle direction={direction} onPick={handleDirection} />
      </div>

      {/* 정류장 칩 row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-3 pb-0.5">
        <Chip
          label="자동"
          active={autoMode}
          onClick={() => handlePickStation('자동')}
          accent
        />
        {allowedStations.map((s) => (
          <Chip
            key={s}
            label={getBusStationDisplay(s)}
            active={!autoMode && selectedBusStation === s}
            onClick={() => handlePickStation(s)}
          />
        ))}
      </div>
    </div>
  )
}

function DirectionToggle({ direction, onPick }) {
  return (
    <div
      className="flex bg-surface-alt dark:bg-surface-dark-alt rounded-pill p-[3px] shrink-0"
      role="group"
      aria-label="방향"
    >
      {['등교', '하교'].map((d) => {
        const active = direction === d
        return (
          <button
            key={d}
            type="button"
            onClick={() => onPick(d)}
            aria-pressed={active}
            aria-label={d}
            className={`px-3 py-1.5 rounded-pill text-label font-extrabold tracking-[-0.01em] pressable transition-colors duration-press ease-ios ${
              active
                ? 'bg-ink text-white dark:bg-accent dark:text-black'
                : 'text-mute dark:text-mute-dark'
            }`}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ label, active, onClick, accent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap pressable shrink-0 text-label font-extrabold px-2.5 py-1.5 rounded-btn transition-colors duration-press ease-ios ${
        active
          ? (accent
              ? 'bg-accent text-black'
              : 'bg-ink text-white dark:bg-accent dark:text-black')
          : 'bg-surface text-text dark:bg-surface-dark-alt dark:text-text-dark shadow-card-md'
      }`}
    >
      {label}
    </button>
  )
}
