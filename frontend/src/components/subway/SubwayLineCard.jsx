import { useCountdown } from '../../hooks/useCountdown'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function NextTrainBadge({ train, color }) {
  const { mm, ss, isUrgent, isExpired } = useCountdown(train?.depart_at ?? null)

  if (!train) {
    return <p className="text-sm text-slate-400">운행 종료</p>
  }

  const timerColor = isUrgent || isExpired ? '#e53935' : color

  return (
    <div className="flex items-end gap-3">
      <span
        className="time-num text-3xl font-bold leading-none"
        style={{ color: timerColor }}
      >
        {isExpired ? '곧 출발' : `${mm}:${ss}`}
      </span>
      <span className="text-sm text-slate-500 mb-0.5 leading-none">
        {train.depart_at} · {train.destination}행
      </span>
    </div>
  )
}

export default function SubwayLineCard({ lineName, dirLabel, color, lightColor, trains, onClick }) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const upcoming = trains.filter((t) => timeToMinutes(t.depart_at) > nowMin)
  const nextTrain = upcoming[0] ?? null
  const afterNext = upcoming[1] ?? null
  const missWaitMin = afterNext ? Math.round(timeToMinutes(afterNext.depart_at) - nowMin) : null
  const preview = upcoming.slice(1, 4)

  return (
    <div
      className="rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer pressable"
      onClick={onClick}
    >
      {/* 컬러 헤더 */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: color }}>
        <span className="text-white font-bold text-sm">{lineName}</span>
        <span className="text-white/80 text-sm">{dirLabel}</span>
      </div>

      {/* 다음 열차 */}
      <div className="px-4 py-3" style={{ backgroundColor: lightColor }}>
        <p className="text-xs text-slate-400 mb-1">다음 열차</p>
        <div className="flex items-center justify-between gap-3">
          <NextTrainBadge train={nextTrain} color={color} />
          {missWaitMin != null && (
            <span className="text-xs text-slate-500 bg-white/70 border border-slate-200 px-2 py-1 rounded-full whitespace-nowrap">
              놓치면 {missWaitMin}분 기다림
            </span>
          )}
        </div>
      </div>

      {/* 이후 열차 목록 */}
      {preview.length > 0 && (
        <ul className="divide-y divide-slate-100 bg-white">
          {preview.map((t, i) => (
            <li key={i} className="flex items-center px-4 py-2 gap-3">
              <span className="time-num text-sm font-semibold text-slate-700 min-w-[42px]">
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
