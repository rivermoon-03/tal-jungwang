import { useEffect, useMemo } from 'react'
import { ArrowUp, ArrowDown, MapPin } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import useUserLocation, { getNearestStationInfo } from '../../hooks/useUserLocation'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
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
  const coords = useUserLocation()

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
    <div className="px-3 pt-3 pb-2">
      {/* 정류장 카드 */}
      <div className="relative rounded-card bg-surface dark:bg-surface-dark dark:border dark:border-line-dark shadow-card-md overflow-hidden">
        {/* 좌측 액센트 바 */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: autoMode ? '#4f9fff' : '#94a3b8' }}
        />
        <div className="flex items-center gap-3 px-4 py-3 pl-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-accent/10 text-accent shrink-0">
            <MapPin size={18} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-extrabold tracking-[0.15em] uppercase text-accent leading-none">
              {statusLabel}
            </div>
            <div className="text-[18px] font-black text-ink dark:text-white tracking-[-0.03em] leading-tight mt-1 truncate">
              {stationLabel}
            </div>
            <div className="text-[10px] font-semibold text-mute dark:text-mute-dark mt-0.5">
              {autoMode ? '가장 가까운 정류장' : '수동 선택됨'}
            </div>
          </div>
          <DirectionToggle direction={direction} onPick={handleDirection} />
        </div>
      </div>

      {/* 정류장 칩 row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-2.5 pb-0.5">
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
      className="flex bg-surface-alt dark:bg-surface-dark-alt rounded-pill p-[2px] shrink-0"
      role="group"
      aria-label="방향"
    >
      <button
        type="button"
        onClick={() => onPick('등교')}
        className={`flex items-center justify-center w-8 h-7 rounded-pill text-[10px] font-extrabold pressable ${
          direction === '등교'
            ? 'bg-ink text-white dark:bg-accent dark:text-black'
            : 'text-mute dark:text-mute-dark'
        }`}
        aria-pressed={direction === '등교'}
        aria-label="등교"
      >
        <ArrowUp size={13} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => onPick('하교')}
        className={`flex items-center justify-center w-8 h-7 rounded-pill text-[10px] font-extrabold pressable ${
          direction === '하교'
            ? 'bg-ink text-white dark:bg-accent dark:text-black'
            : 'text-mute dark:text-mute-dark'
        }`}
        aria-pressed={direction === '하교'}
        aria-label="하교"
      >
        <ArrowDown size={13} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function Chip({ label, active, onClick, accent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap pressable shrink-0 text-[10px] font-extrabold px-2.5 py-1.5 rounded-btn transition-colors duration-press ease-ios ${
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
