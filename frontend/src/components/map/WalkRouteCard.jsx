import { X, Footprints } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import IconButton from '../ui/IconButton'

function fmtMin(sec) {
  if (sec == null) return '·'
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
    <div className="absolute bottom-28 md:bottom-4 left-3 z-toast pointer-events-auto
                    bg-surface dark:bg-surface rounded-card shadow-sh-pop
                    border border-line dark:border-line
                    px-4 py-3 flex items-center gap-3 min-w-[200px]">
      <div className="w-9 h-9 rounded-full bg-ease/10 dark:bg-ease/20 flex items-center justify-center flex-shrink-0">
        <Footprints size={18} className="text-ease" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body font-bold text-ink dark:text-ink truncate">
          {walkRoute.destName ?? '목적지'}까지 도보
        </p>
        <p className="text-caption text-mute dark:text-mute tabular-nums">
          {fmtMin(walkRoute.durationSec)} · {fmtDist(walkRoute.distanceM)}
        </p>
      </div>
      <IconButton
        label="경로 닫기"
        variant="surface"
        onClick={clearWalkRoute}
        className="flex-shrink-0 hover:text-ink dark:hover:text-ink"
      >
        <X size={14} />
      </IconButton>
    </div>
  )
}
