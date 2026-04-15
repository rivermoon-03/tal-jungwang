import { Navigation } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useTaxiDestinations } from '../../hooks/useTaxi'
import Skeleton from '../common/Skeleton'

function fmtMin(sec) {
  if (sec == null) return '—'
  const m = Math.round(sec / 60)
  return m === 0 ? '1분 미만' : `약 ${m}분`
}

function fmtKm(meters) {
  if (meters == null) return ''
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

/**
 * SummaryCard 의 '택시' 탭. 학교 정문 → 주요 목적지 자동차 소요시간.
 * 항목 클릭 시 카카오모빌리티 경로를 지도에 파란 Polyline 으로 렌더.
 */
export default function TaxiPanel() {
  const { destinations, loading } = useTaxiDestinations()
  const driveRouteCoords    = useAppStore((s) => s.driveRouteCoords)
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)

  function handleRoute(dest) {
    if (!dest.coordinates?.length) return
    setDriveRouteCoords(
      driveRouteCoords === dest.coordinates ? null : dest.coordinates
    )
  }

  if (loading || !destinations) {
    return <Skeleton height="3rem" rounded="rounded-xl" />
  }

  return (
    <div className="space-y-2">
      {destinations.map((dest) => {
        const isActive = driveRouteCoords === dest.coordinates && dest.coordinates?.length > 0
        const hasRoute = dest.coordinates?.length > 0
        return (
          <div
            key={dest.id}
            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                {dest.name}
              </p>
              <p className="text-[11px] text-slate-400">{fmtKm(dest.distance_meters)}</p>
            </div>
            <span className="text-sm font-extrabold tabular-nums text-navy dark:text-blue-300 whitespace-nowrap">
              {fmtMin(dest.duration_seconds)}
            </span>
            <button
              aria-label={`${dest.name} 경로 보기`}
              onClick={() => handleRoute(dest)}
              disabled={!hasRoute}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-navy text-white'
                  : hasRoute
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    : 'bg-slate-50 dark:bg-slate-700/50 text-slate-300 cursor-not-allowed'
              }`}
              style={isActive ? { background: '#1b3a6e' } : undefined}
            >
              <Navigation size={13} />
            </button>
          </div>
        )
      })}
      <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center pt-1">
        학교 정문 출발 · 실제 요금·시간과 다를 수 있습니다
      </p>
    </div>
  )
}
