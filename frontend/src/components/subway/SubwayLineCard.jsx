import { useCountdown } from '../../hooks/useCountdown'
import useAppStore from '../../stores/useAppStore'
import { getSpecialTrainIndices } from '../../utils/trainTime'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function NextTrainBadge({ train, color, darkColor }) {
  const { mm, ss, isUrgent, isExpired } = useCountdown(train?.depart_at ?? null)
  const darkMode = useAppStore((s) => s.darkMode)

  if (!train) {
    return <p className="text-sm text-slate-400">운행 종료</p>
  }

  const baseColor = darkMode ? (darkColor ?? color) : color
  const timerColor = isUrgent || isExpired ? '#ef4444' : baseColor

  return (
    <div className="flex items-end gap-3">
      <span
        className="time-num text-3xl font-bold leading-none"
        style={{ color: timerColor }}
      >
        {isExpired ? '곧 출발' : `${mm}:${ss}`}
      </span>
      <span className="text-sm text-slate-500 dark:text-slate-400 mb-0.5 leading-none">
        {train.depart_at} · {train.destination}행
      </span>
    </div>
  )
}

export default function SubwayLineCard({ lineName, dirLabel, color, darkColor, lightColor, trains, onClick }) {
  const darkMode = useAppStore((s) => s.darkMode)
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const nextTrainIdx = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const upcoming = nextTrainIdx >= 0 ? trains.slice(nextTrainIdx) : []
  const nextTrain = upcoming[0] ?? null
  const afterNext = upcoming[1] ?? null
  const missWaitMin = afterNext ? Math.round(timeToMinutes(afterNext.depart_at) - nowMin) : null
  const preview = upcoming.slice(1, 4)

  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)
  const isLast  = nextTrainIdx >= 0 && nextTrainIdx === lastIdx
  const isFirst = nextTrainIdx >= 0 && nextTrainIdx === firstIdx

  return (
    <div
      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer pressable"
      onClick={onClick}
    >
      {/* 컬러 헤더 */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: color }}>
        <span className="text-white font-bold text-sm">{lineName}</span>
        <span className="text-white/80 text-sm">{dirLabel}</span>
      </div>

      {/* 다음 열차 — lightColor는 라이트 모드용, 다크에선 slate-800 */}
      <div
        className="px-4 py-3 dark:bg-slate-800"
        style={{ backgroundColor: darkMode ? undefined : lightColor }}
      >
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-slate-400">다음 열차</p>
          {nextTrain && isLast && (
            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">
              막차
            </span>
          )}
          {nextTrain && isFirst && (
            <span className="text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full leading-none">
              첫차
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <NextTrainBadge train={nextTrain} color={color} darkColor={darkColor} />
          {missWaitMin != null && (
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-700/70 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-full whitespace-nowrap">
              놓치면 {missWaitMin}분 기다림
            </span>
          )}
        </div>
      </div>

      {/* 이후 열차 목록 */}
      {preview.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
          {preview.map((t, i) => (
            <li key={i} className="flex items-center px-4 py-2 gap-3">
              <span className="time-num text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[42px]">
                {t.depart_at}
              </span>
              <span className="text-sm text-slate-400">{t.destination}행</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
