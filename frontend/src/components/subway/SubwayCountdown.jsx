import { useCountdown } from '../../hooks/useCountdown'
import useAppStore from '../../stores/useAppStore'

export default function SubwayCountdown({ nextTrain, lineColor, lineDarkColor }) {
  const { mm, ss, isUrgent, isExpired } = useCountdown(nextTrain?.depart_at ?? null)
  const darkMode = useAppStore((s) => s.darkMode)

  if (!nextTrain) {
    return (
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-5">
        <p className="text-base text-slate-500 dark:text-slate-400">오늘 운행이 종료됐습니다.</p>
      </div>
    )
  }

  const baseColor = darkMode ? (lineDarkColor ?? lineColor) : lineColor
  const timerColor = isExpired || isUrgent ? '#ef4444' : baseColor

  return (
    <div className="flex items-center justify-between bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-4">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">다음 열차</p>
        <p
          className="time-num text-3xl font-bold leading-none"
          style={{ color: timerColor }}
        >
          {isExpired ? '곧 출발' : `${mm}:${ss}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{nextTrain.depart_at}</p>
        <p className="text-sm text-slate-400 mt-0.5">{nextTrain.destination}행</p>
      </div>
    </div>
  )
}
