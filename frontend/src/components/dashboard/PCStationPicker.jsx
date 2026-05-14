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

  // 미니맵에서 사용자 위치 / 정류장 핀 표시할 위치 계산
  // 좌표를 SVG 비례로 변환 (간단한 normalize: bounding box 기반)
  const positions = useMemo(() => {
    if (!coords) return null
    const allStations = Object.entries(STATION_COORDS)
    const lats = [coords[0], ...allStations.map(([, c]) => c[0])]
    const lngs = [coords[1], ...allStations.map(([, c]) => c[1])]
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const pad = 0.12
    const toXY = ([lat, lng]) => ({
      x: ((lng - minLng) / (maxLng - minLng || 1)) * (100 - pad * 200) + pad * 100,
      y: 100 - (((lat - minLat) / (maxLat - minLat || 1)) * (100 - pad * 200) + pad * 100),
    })
    return {
      user: toXY(coords),
      stations: allStations.map(([name, c]) => ({ name, ...toXY(c) })),
    }
  }, [coords])

  const distLabel = nearestInfo
    ? (nearestInfo.distanceM < 1000
        ? `${nearestInfo.distanceM}m`
        : `${(nearestInfo.distanceM / 1000).toFixed(1)}km`)
    : null

  return (
    <div className="px-3 pt-3 pb-2">
      {/* Glass Map Card */}
      <div className="relative h-[150px] rounded-card overflow-hidden shadow-card-md">
        {/* 미니맵 배경 */}
        <MiniMapBg />

        {/* 정류장 핀들 */}
        {positions && positions.stations.map((s) => {
          const isNearest = nearestInfo?.name === s.name
          if (!isNearest) return null  // 가장 가까운 정류장만 (시각 단순화)
          return (
            <div
              key={s.name}
              className="absolute z-[2]"
              style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div
                className="w-[22px] h-[22px] bg-ink dark:bg-white rounded-tl-full rounded-tr-full rounded-br-full"
                style={{ transform: 'rotate(45deg)', boxShadow: '0 3px 8px rgba(0,0,0,0.3)', border: '3px solid #fff' }}
                aria-label={`가장 가까운 정류장 ${s.name}`}
              />
            </div>
          )
        })}

        {/* 사용자 핀 */}
        {positions && (
          <div
            className="absolute z-[2] w-[14px] h-[14px] bg-accent border-[3px] border-white rounded-full"
            style={{
              left: `${positions.user.x}%`,
              top: `${positions.user.y}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 0 6px rgba(79, 159, 255, 0.25), 0 2px 6px rgba(0,0,0,0.2)',
              animation: 'userPulse 2.5s ease-out infinite',
            }}
          />
        )}

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

function MiniMapBg() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(135deg, #e0e8f0 0%, #d2dde8 35%, #cfd8e3 60%, #d8e0ea 100%)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, transparent 38%, #fff 38.4%, #fff 40%, transparent 40.4%), linear-gradient(20deg, transparent 52%, #fff 52.3%, #fff 53.4%, transparent 53.7%)',
          opacity: 0.55,
        }}
      />
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
