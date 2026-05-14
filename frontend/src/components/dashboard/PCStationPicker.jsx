import { useEffect, useMemo } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import useUserLocation, { STATION_COORDS, getNearestStationInfo } from '../../hooks/useUserLocation'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import {
  BUS_STATION_LABELS,
  getAllowedDirections,
  getBusStationDisplay,
} from './busStationConfig'
import MiniKakaoMap from './MiniKakaoMap'

// PC 전용 정류장 picker. spec B (Glass Map) 톤.
// - 미니 지도 (SVG) 위에 사용자 위치 핀 + 가장 가까운 정류장 핀
// - 하단 glass overlay: "자동 · 68m" + 정류장 이름 + 등교/하교 토글
// - 카드 밖 horizontal chip row: "자동 / 한국공학대 / 시화터미널 / …"
// - 모바일에는 노출 안 됨 (md:block in caller)

export default function PCStationPicker() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const setBusStation       = useAppStore((s) => s.setBusStation)
  const autoMode            = useAppStore((s) => s.busStationAutoMode)
  const setAutoMode         = useAppStore((s) => s.setBusStationAutoMode)
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const { direction } = useEffectiveDirection()
  const coords = useUserLocation()

  // 현재 방향에 허용되는 정류장만 표시
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

  // 사용자가 칩 클릭 → 수동 lock
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

  // 미니맵 중심: 사용자 ↔ 가장 가까운 정류장의 중간점.
  // 둘 중 하나만 있으면 그것 기준. 둘 다 없으면 한국공학대 기본.
  const mapCenter = useMemo(() => {
    const userLat = coords?.[0]
    const userLng = coords?.[1]
    const stCoord = nearestInfo ? STATION_COORDS[nearestInfo.name] : null
    if (userLat != null && userLng != null && stCoord) {
      return { lat: (userLat + stCoord[0]) / 2, lng: (userLng + stCoord[1]) / 2 }
    }
    if (userLat != null && userLng != null) return { lat: userLat, lng: userLng }
    if (stCoord) return { lat: stCoord[0], lng: stCoord[1] }
    const home = STATION_COORDS['한국공학대']
    return { lat: home[0], lng: home[1] }
  }, [coords, nearestInfo])

  // 줌 레벨 — 사용자와 정류장 거리에 따라 자동 조정 (가까우면 더 줌인)
  const mapLevel = useMemo(() => {
    if (!nearestInfo) return 4
    const d = nearestInfo.distanceM
    if (d < 100)   return 2
    if (d < 300)   return 3
    if (d < 800)   return 4
    if (d < 2000)  return 5
    if (d < 5000)  return 6
    return 7
  }, [nearestInfo])

  const userPos = coords ? { lat: coords[0], lng: coords[1] } : null
  const stationCoord = nearestInfo ? STATION_COORDS[nearestInfo.name] : null
  const stationPos = stationCoord ? { lat: stationCoord[0], lng: stationCoord[1] } : null

  const distLabel = nearestInfo
    ? (nearestInfo.distanceM < 1000
        ? `${nearestInfo.distanceM}m`
        : `${(nearestInfo.distanceM / 1000).toFixed(1)}km`)
    : null

  return (
    <div className="px-3 pt-3 pb-2">
      {/* Glass Map Card */}
      <div className="relative h-[150px] rounded-card overflow-hidden shadow-card-md">
        {/* 실제 Kakao 미니맵 */}
        <MiniKakaoMap
          center={mapCenter}
          userPos={userPos}
          stationPos={stationPos}
          level={mapLevel}
        />

        {/* Glass info overlay */}
        <div
          className="absolute left-3 right-3 bottom-3 rounded-mini px-3 py-2.5 flex items-center gap-2.5"
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-extrabold tracking-[0.15em] uppercase text-accent">
              {autoMode ? `자동${distLabel ? ' · ' + distLabel : ''}` : '수동'}
            </div>
            <div className="text-[14px] font-black text-ink leading-tight mt-0.5 truncate">
              {getBusStationDisplay(selectedBusStation) || selectedBusStation}
            </div>
            <div className="text-[9px] font-semibold text-mute mt-0.5">
              {autoMode
                ? '가장 가까운 정류장'
                : '수동 선택됨'}
            </div>
          </div>
          <DirectionToggle direction={direction} onPick={handleDirection} />
        </div>
      </div>

      {/* Manual override chip row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-2.5 pb-0.5">
        <Chip label="자동" active={autoMode} onClick={() => handlePickStation('자동')} accent />
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
    <div className="flex bg-surface-alt dark:bg-surface-dark-alt rounded-pill p-[2px]" role="group" aria-label="방향">
      <button
        type="button"
        onClick={() => onPick('등교')}
        className={`flex items-center justify-center w-7 h-6 rounded-pill text-[10px] font-extrabold pressable ${
          direction === '등교' ? 'bg-ink text-white dark:bg-accent dark:text-black' : 'text-mute dark:text-mute-dark'
        }`}
        aria-pressed={direction === '등교'}
        aria-label="등교"
      >
        <ArrowUp size={12} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => onPick('하교')}
        className={`flex items-center justify-center w-7 h-6 rounded-pill text-[10px] font-extrabold pressable ${
          direction === '하교' ? 'bg-ink text-white dark:bg-accent dark:text-black' : 'text-mute dark:text-mute-dark'
        }`}
        aria-pressed={direction === '하교'}
        aria-label="하교"
      >
        <ArrowDown size={12} strokeWidth={2.5} />
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
