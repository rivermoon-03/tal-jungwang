import { X, Navigation } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useTaxiDestinations } from '../../hooks/useTaxi'

// ── 유틸 ─────────────────────────────────────────────────
function fmtMin(sec) {
  if (sec == null) return '—'
  const m = Math.round(sec / 60)
  return m === 0 ? '1분 미만' : `약 ${m}분`
}

function fmtKm(meters) {
  if (meters == null) return ''
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${meters} m`
}

// ── 메인 카드 ─────────────────────────────────────────────
export default function TaxiCard({ open, onClose }) {
  const { destinations, loading } = useTaxiDestinations()
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const driveRouteCoords    = useAppStore((s) => s.driveRouteCoords)

  function handleRoute(dest) {
    if (!dest.coordinates?.length) return
    setDriveRouteCoords(
      driveRouteCoords === dest.coordinates ? null : dest.coordinates
    )
  }

  return (
    <div
      className={`absolute bottom-28 md:bottom-4 right-3 z-[65] w-72
        bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
        transition-transform duration-300 ease-out pointer-events-auto
        ${open ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]'}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">학교에서 가는 시간</p>
        <button
          aria-label="닫기"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors pressable"
        >
          <X size={15} />
        </button>
      </div>

      {/* 목록 — 경로 활성화 시 해당 항목만 표시 */}
      <div className="divide-y divide-slate-50 dark:divide-slate-700">
        {loading || !destinations ? (
          <div className="px-4 py-5 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          destinations
            .filter((dest) => {
              if (!driveRouteCoords) return true
              return driveRouteCoords === dest.coordinates
            })
            .map((dest) => {
              const isActive = driveRouteCoords === dest.coordinates && dest.coordinates?.length > 0
              const hasRoute = dest.coordinates?.length > 0
              return (
                <div key={dest.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">{dest.name}</p>
                    <p className="text-xs text-slate-400">{fmtKm(dest.distance_meters)}</p>
                  </div>
                  <span className="text-lg font-extrabold tabular-nums text-navy dark:text-blue-300 whitespace-nowrap">
                    {fmtMin(dest.duration_seconds)}
                  </span>
                  <button
                    aria-label={`${dest.name} 경로 보기`}
                    onClick={() => handleRoute(dest)}
                    disabled={!hasRoute}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors pressable flex-shrink-0 ${
                      isActive
                        ? 'bg-navy text-white'
                        : hasRoute
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                          : 'bg-slate-50 dark:bg-slate-700/50 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <Navigation size={15} />
                  </button>
                </div>
              )
            })
        )}
      </div>
      <p className="px-4 pb-3 text-[11px] text-slate-300 dark:text-slate-600 text-center">
        실제 요금·시간과 다를 수 있습니다
      </p>
    </div>
  )
}
