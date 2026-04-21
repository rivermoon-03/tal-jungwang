import { useState, useEffect } from 'react'
import { Navigation } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { apiFetch } from '../../hooks/useApi'

const TAXI_DESTS = [
  { id: 'jeongwang',       name: '정왕역',       lat: 37.351618,  lng: 126.742747 },
  { id: 'siheung_station', name: '시흥시청역',   lat: 37.37970,   lng: 126.80260  },
  { id: 'sadang',          name: '사당역',        lat: 37.47624,   lng: 126.98175  },
  { id: 'baegot',          name: '배곧(라온초)', lat: 37.37258,   lng: 126.73493  },
]

function fmtMin(sec) {
  if (sec == null) return '—'
  const m = Math.round(sec / 60)
  return m === 0 ? '1분 미만' : `약 ${m}분`
}

function fmtKm(meters) {
  if (meters == null) return ''
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

function DestRow({ dest, origin }) {
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const driveRouteCoords    = useAppStore((s) => s.driveRouteCoords)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!origin) return
    setLoading(true)
    setResult(null)
    apiFetch('/route/driving', {
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
  }, [origin?.lat, origin?.lng, dest.lat, dest.lng])

  const isActive = driveRouteCoords === result?.coordinates && result?.coordinates?.length > 0
  const hasRoute = result?.coordinates?.length > 0

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">{dest.name}</p>
        {result && <p className="text-[11px] text-[#94a3b8]">{fmtKm(result.distance_meters)}</p>}
      </div>
      <span className="text-[16px] font-extrabold tabular-nums text-navy dark:text-blue-300 whitespace-nowrap">
        {loading
          ? <span className="text-[13px] text-[#94a3b8] font-normal">조회 중…</span>
          : fmtMin(result?.duration_seconds)}
      </span>
      <button
        aria-label={`${dest.name} 경로 보기`}
        onClick={() => setDriveRouteCoords(isActive ? null : result?.coordinates)}
        disabled={!hasRoute}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors pressable flex-shrink-0
          ${isActive
            ? 'bg-navy text-white'
            : hasRoute
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              : 'bg-slate-50 dark:bg-slate-700/50 text-slate-300 cursor-not-allowed'}`}
      >
        <Navigation size={14} />
      </button>
    </div>
  )
}

export default function TaxiPanel() {
  const userLocation = useAppStore((s) => s.userLocation)

  if (!userLocation) {
    return (
      <p className="text-center text-[13px] text-[#94a3b8] py-6">
        GPS 위치를 켜주세요
      </p>
    )
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {TAXI_DESTS.map((dest) => (
        <DestRow key={dest.id} dest={dest} origin={userLocation} />
      ))}
      <p className="pt-2 text-[11px] text-[#cbd5e1] dark:text-slate-600 text-center">
        실제 요금·시간과 다를 수 있습니다
      </p>
    </div>
  )
}
