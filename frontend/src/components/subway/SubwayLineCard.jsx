import { useCountdown } from '../../hooks/useCountdown'
import useAppStore from '../../stores/useAppStore'
import { getSpecialTrainIndices } from '../../utils/trainTime'
import StatusChip from '../ui/StatusChip'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function NextTrainBadge({ train, color, darkColor }) {
  const { mm, ss, isUrgent, isExpired } = useCountdown(train?.depart_at ?? null)
  const darkMode = useAppStore((s) => s.darkMode)

  if (!train) {
    return <p className="text-label font-medium text-mute dark:text-mute">운행 종료</p>
  }

  const baseColor = darkMode ? (darkColor ?? color) : color
  const timerColor = isUrgent || isExpired ? '#ef4444' : baseColor

  return (
    <div className="flex items-end gap-3">
      <span
        className="text-countdown font-bold tabular-nums leading-none tracking-tight"
        style={{ color: timerColor }}
      >
        {isExpired ? '곧 출발' : `${mm}:${ss}`}
      </span>
      <span className="text-label font-semibold text-ink-2 dark:text-ink-2 mb-1 leading-none">
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
  const missWaitMin = afterNext && nextTrain
    ? Math.round(timeToMinutes(afterNext.depart_at) - timeToMinutes(nextTrain.depart_at))
    : null
  const preview = upcoming.slice(1, 4)

  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)
  const isLast  = nextTrainIdx >= 0 && nextTrainIdx === lastIdx
  const isFirst = nextTrainIdx >= 0 && nextTrainIdx === firstIdx

  return (
    <div
      className="rounded-card overflow-hidden shadow-card cursor-pointer pressable"
      onClick={onClick}
    >
      {/* 컬러 헤더 */}
      <div className="px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: color }}>
        <span className="text-white font-semibold text-[15px] tracking-tight">{lineName}</span>
        <span className="text-white/85 text-label font-semibold">{dirLabel}</span>
      </div>

      {/* 다음 열차 — lightColor는 라이트 모드용, 다크에선 surface */}
      <div
        className="px-4 py-3.5 dark:bg-surface"
        style={{ backgroundColor: darkMode ? undefined : lightColor }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-label font-bold text-mute dark:text-mute tracking-wide">다음 열차</p>
          {nextTrain && isLast && (
            <StatusChip kind="last">막차</StatusChip>
          )}
          {nextTrain && isFirst && (
            <StatusChip kind="beta">첫차</StatusChip>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <NextTrainBadge train={nextTrain} color={color} darkColor={darkColor} />
          {missWaitMin != null && (
            <span className="text-label font-semibold text-ink-2 dark:text-ink-2 bg-surface dark:bg-surface shadow-pill px-2.5 py-1 rounded-full whitespace-nowrap">
              놓치면 {missWaitMin}분 더 기다림
            </span>
          )}
        </div>
      </div>

      {/* 이후 열차 목록 */}
      {preview.length > 0 && (
        <ul className="divide-y divide-line dark:divide-line bg-surface dark:bg-surface">
          {preview.map((t, i) => (
            <li key={i} className="flex items-center px-4 py-2.5 gap-3">
              <span className="text-label font-bold tabular-nums text-ink dark:text-ink min-w-[46px]">
                {t.depart_at}
              </span>
              <span className="text-label font-medium text-mute dark:text-mute">{t.destination}행</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
