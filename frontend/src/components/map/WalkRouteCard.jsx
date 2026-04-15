import { X, Footprints } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

function fmtMin(sec) {
  if (sec == null) return '—'
  const m = Math.round(sec / 60)
  return m === 0 ? '1분 미만' : `${m}분`
}

function fmtDist(m) {
  if (m == null) return ''
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}

/**
 * 도보 경로 표시 중일 때만 뜨는 작은 카드. walkRoute 가 null 이면 숨김.
 */
export default function WalkRouteCard() {
  const walkRoute = useAppStore((s) => s.walkRoute)
  const clearWalkRoute = useAppStore((s) => s.clearWalkRoute)

  if (!walkRoute) return null

  return (
    <div className="absolute bottom-28 md:bottom-4 left-3 z-[65] pointer-events-auto
                    bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
                    border border-slate-100 dark:border-slate-700
                    px-4 py-3 flex items-center gap-3 min-w-[200px]">
      <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
        <Footprints size={18} className="text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
          {walkRoute.destName ?? '목적지'}까지 도보
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {fmtMin(walkRoute.durationSec)} · {fmtDist(walkRoute.distanceM)}
        </p>
      </div>
      <button
        aria-label="경로 닫기"
        onClick={clearWalkRoute}
        className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center
                   text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
                   hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
