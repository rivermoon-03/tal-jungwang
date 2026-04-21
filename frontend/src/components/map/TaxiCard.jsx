import { useState, useEffect, useCallback } from 'react'
import { Bus, Train, School, Car, Navigation, MapPin } from 'lucide-react'
import BottomSheet from '../transit/BottomSheet'
import useAppStore from '../../stores/useAppStore'
import { apiFetch } from '../../hooks/useApi'

// ── 목적지 상수 ────────────────────────────────────────────
const DESTS = {
  bus:     { name: '버스 정류장',  lat: 37.3395,   lng: 126.7334,  mode: 'walk' },
  subway:  { name: '정왕역',       lat: 37.351618,  lng: 126.742747, mode: 'walk' },
  shuttle: { name: '셔틀 탑승지',  lat: 37.339343,  lng: 126.73279, mode: 'walk' },
}
const TAXI_DESTS = [
  { id: 'jeongwang',       name: '정왕역',       lat: 37.351618,  lng: 126.742747 },
  { id: 'siheung_station', name: '시흥시청역',   lat: 37.37970,   lng: 126.80260  },
  { id: 'sadang',          name: '사당역',        lat: 37.47624,   lng: 126.98175  },
  { id: 'baegot',          name: '배곧(라온초)', lat: 37.37258,   lng: 126.73493  },
]

const TABS = [
  { id: 'bus',    label: '버스',   Icon: Bus    },
  { id: 'subway', label: '지하철', Icon: Train  },
  { id: 'shuttle',label: '셔틀',   Icon: School },
  { id: 'taxi',   label: '택시',   Icon: Car    },
]

// ── 유틸 ──────────────────────────────────────────────────
function fmtMin(sec) {
  if (sec == null) return '—'
  const m = Math.round(sec / 60)
  return m === 0 ? '1분 미만' : `약 ${m}분`
}
function fmtKm(meters) {
  if (meters == null) return ''
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

// ── 단일 경로 훅 ───────────────────────────────────────────
function useRouteOnce(origin, dest, mode, enabled) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !origin) return
    setLoading(true)
    setResult(null)
    const endpoint = mode === 'walk' ? '/route/walking' : '/route/driving'
    apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin:      { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat,   lng: dest.lng   },
      }),
    })
      .then((data) => setResult(data))
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [enabled, origin?.lat, origin?.lng, dest.lat, dest.lng, mode])

  return { result, loading }
}

// ── 탭 콘텐츠: 도보 (버스/지하철/셔틀) ─────────────────────
function WalkTab({ tabId, origin }) {
  const dest = DESTS[tabId]
  const setWalkRoute      = useAppStore((s) => s.setWalkRoute)
  const clearWalkRoute    = useAppStore((s) => s.clearWalkRoute)
  const walkRoute         = useAppStore((s) => s.walkRoute)
  const { result, loading } = useRouteOnce(origin, dest, 'walk', !!origin)

  const isActive = walkRoute?.destination_key === tabId

  function handleRoute() {
    if (!result?.coordinates?.length) return
    if (isActive) {
      clearWalkRoute()
    } else {
      setWalkRoute({ coordinates: result.coordinates, destination_key: tabId })
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-4">
        <MapPin size={18} className="text-slate-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{dest.name}</p>
          {result && (
            <p className="text-xs text-slate-400 mt-0.5">{fmtKm(result.distance_meters)}</p>
          )}
        </div>
        <div className="text-right">
          {loading ? (
            <span className="text-sm text-slate-400">조회 중…</span>
          ) : result ? (
            <span className="text-2xl font-extrabold tabular-nums text-navy dark:text-blue-300">
              {fmtMin(result.duration_seconds)}
            </span>
          ) : origin ? (
            <span className="text-sm text-slate-400">조회 실패</span>
          ) : null}
        </div>
      </div>

      {!origin && (
        <p className="text-center text-sm text-slate-400 py-2">GPS 위치를 켜주세요</p>
      )}

      {result?.coordinates?.length > 0 && (
        <button
          onClick={handleRoute}
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-colors pressable
            ${isActive
              ? 'bg-navy text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
        >
          <Navigation size={15} />
          {isActive ? '경로 숨기기' : '지도에서 경로 보기'}
        </button>
      )}
    </div>
  )
}

// ── 택시 탭 — 목적지 한 줄 ────────────────────────────────
function TaxiDestRow({ dest, origin }) {
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const driveRouteCoords    = useAppStore((s) => s.driveRouteCoords)
  const { result, loading } = useRouteOnce(origin, dest, 'drive', !!origin)

  const isActive = driveRouteCoords === result?.coordinates && result?.coordinates?.length > 0
  const hasRoute = result?.coordinates?.length > 0

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{dest.name}</p>
        {result && <p className="text-xs text-slate-400">{fmtKm(result.distance_meters)}</p>}
      </div>
      <span className="text-lg font-extrabold tabular-nums text-navy dark:text-blue-300 whitespace-nowrap">
        {loading
          ? <span className="text-sm text-slate-400 font-normal">조회 중…</span>
          : fmtMin(result?.duration_seconds)}
      </span>
      <button
        aria-label={`${dest.name} 경로 보기`}
        onClick={() => setDriveRouteCoords(isActive ? null : result?.coordinates)}
        disabled={!hasRoute}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors pressable flex-shrink-0
          ${isActive
            ? 'bg-navy text-white'
            : hasRoute
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              : 'bg-slate-50 dark:bg-slate-700/50 text-slate-300 cursor-not-allowed'}`}
      >
        <Navigation size={15} />
      </button>
    </div>
  )
}

// ── 탭 콘텐츠: 택시 ────────────────────────────────────────
function TaxiTab({ origin }) {
  return (
    <div className="flex flex-col divide-y divide-slate-50 dark:divide-slate-800">
      {!origin && (
        <p className="text-center text-sm text-slate-400 py-6">GPS 위치를 켜주세요</p>
      )}
      {origin && TAXI_DESTS.map((dest) => (
        <TaxiDestRow key={dest.id} dest={dest} origin={origin} />
      ))}
      {origin && (
        <p className="px-5 py-3 text-[11px] text-slate-300 dark:text-slate-600 text-center">
          실제 요금·시간과 다를 수 있습니다
        </p>
      )}
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────
export default function TaxiCard({ open, onClose }) {
  const userLocation = useAppStore((s) => s.userLocation)
  const [activeTab, setActiveTab] = useState('bus')

  return (
    <BottomSheet open={open} onClose={onClose} title="길 찾기">
      {/* 탭 바 */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 px-2 flex-shrink-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors pressable
              ${activeTab === id
                ? 'text-navy dark:text-blue-300 border-b-2 border-navy dark:border-blue-300'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'taxi'
          ? <TaxiTab origin={userLocation} />
          : <WalkTab tabId={activeTab} origin={userLocation} />
        }
      </div>
    </BottomSheet>
  )
}
