import { X, Navigation } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useTaxiDestinations } from '../../hooks/useTaxi'

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

export default function TaxiCard({ open, onClose }) {
  const { destinations, loading } = useTaxiDestinations()
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const driveRouteCoords = useAppStore((s) => s.driveRouteCoords)

  function handleRoute(dest) {
    if (!dest.coordinates?.length) return
    // 이미 같은 경로가 표시 중이면 토글
    setDriveRouteCoords(
      driveRouteCoords === dest.coordinates ? null : dest.coordinates
    )
  }

  return (
    <div
      className={`absolute bottom-28 md:bottom-4 right-3 z-[65] w-72 bg-white rounded-2xl shadow-2xl
        transition-transform duration-300 ease-out pointer-events-auto
        ${open ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]'}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-base font-extrabold text-slate-900">택시 예상 시간</p>
          <p className="text-xs text-slate-400 mt-0.5">카카오모빌리티 · 실시간 교통 반영</p>
        </div>
        <button
          aria-label="닫기"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors pressable"
        >
          <X size={15} />
        </button>
      </div>

      {/* 목적지 목록 */}
      <div className="divide-y divide-slate-50">
        {loading || !destinations ? (
          <div className="px-4 py-5 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : (
          destinations.map((dest) => {
            const isActive = driveRouteCoords === dest.coordinates && dest.coordinates?.length > 0
            const hasRoute = dest.coordinates?.length > 0
            return (
              <div key={dest.id} className="flex items-center gap-3 px-4 py-3">
                {/* 목적지 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-slate-900 truncate">{dest.name}</p>
                  <p className="text-xs text-slate-400">{fmtKm(dest.distance_meters)}</p>
                </div>
                {/* 소요 시간 */}
                <span className="text-lg font-extrabold tabular-nums text-navy whitespace-nowrap">
                  {fmtMin(dest.duration_seconds)}
                </span>
                {/* 경로 버튼 */}
                <button
                  aria-label={`${dest.name} 경로 보기`}
                  onClick={() => handleRoute(dest)}
                  disabled={!hasRoute}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors pressable flex-shrink-0 ${
                    isActive
                      ? 'bg-navy text-white'
                      : hasRoute
                        ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <Navigation size={15} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* 경고 */}
      <p className="px-4 pb-3 text-[11px] text-slate-300 text-center">
        실제 요금·시간과 다를 수 있습니다
      </p>
    </div>
  )
}
