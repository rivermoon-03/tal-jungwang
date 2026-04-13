import { useCountdown } from '../../hooks/useCountdown'

export default function SubwayCountdown({ nextTrain, lineColor }) {
  const { mm, ss, isUrgent, isExpired } = useCountdown(nextTrain?.depart_at ?? null)

  if (!nextTrain) {
    return (
      <div className="bg-white border-b border-slate-200 px-5 py-5">
        <p className="text-base text-slate-500">오늘 운행이 종료됐습니다.</p>
      </div>
    )
  }

  const timerColor = isExpired || isUrgent ? '#e53935' : lineColor

  return (
    <div className="flex items-center justify-between bg-white border-b border-slate-200 px-5 py-4">
      <div>
        <p className="text-sm text-slate-500 mb-1">다음 열차</p>
        <p
          className="time-num text-3xl font-bold leading-none"
          style={{ color: timerColor }}
        >
          {isExpired ? '곧 출발' : `${mm}:${ss}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-base font-bold text-slate-900">{nextTrain.depart_at}</p>
        <p className="text-sm text-slate-400 mt-0.5">{nextTrain.destination}행</p>
      </div>
    </div>
  )
}
