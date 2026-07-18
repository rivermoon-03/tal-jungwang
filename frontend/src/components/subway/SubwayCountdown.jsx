import { useCountdown } from '../../hooks/useCountdown'
import useAppStore from '../../stores/useAppStore'

export default function SubwayCountdown({ nextTrain, lineColor, lineDarkColor }) {
  const { mm, ss, isUrgent, isExpired } = useCountdown(nextTrain?.depart_at ?? null)
  const darkMode = useAppStore((s) => s.darkMode)

  if (!nextTrain) {
    return (
      <div className="bg-surface dark:bg-surface border-b border-line dark:border-line px-5 py-5">
        <p className="text-meta font-bold text-mute dark:text-mute">오늘 운행이 종료됐습니다.</p>
      </div>
    )
  }

  const baseColor = darkMode ? (lineDarkColor ?? lineColor) : lineColor
  const timerColor = isExpired || isUrgent ? '#ef4444' : baseColor

  return (
    <div className="flex items-center justify-between bg-surface dark:bg-surface border-b border-line dark:border-line px-5 py-4">
      <div>
        <p className="text-meta font-bold text-mute dark:text-mute mb-1.5 tracking-wide">다음 열차</p>
        <p
          className="text-countdown font-bold tabular-nums leading-none"
          style={{ color: timerColor }}
        >
          {isExpired ? '곧 출발' : `${mm}:${ss}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-panel-ttl text-ink dark:text-ink">{nextTrain.depart_at}</p>
        <p className="text-meta font-medium text-mute dark:text-mute mt-1">{nextTrain.destination}행</p>
      </div>
    </div>
  )
}
