import { useCountdown } from '../../hooks/useCountdown'

export default function ShuttleCountdown({ nextShuttle, direction }) {
  const isFrequent = nextShuttle?.note === '수시운행'
  const isReturn   = nextShuttle?.note?.startsWith('회차편') ?? false
  const departAt = nextShuttle?.depart_at ?? null

  const { mm, ss, totalSeconds, isUrgent, isExpired } = useCountdown(
    isFrequent || isReturn ? null : departAt
  )

  if (!nextShuttle) {
    return (
      <div className="bg-white border-b border-slate-200 px-5 py-5">
        <p className="text-base text-slate-500">오늘 남은 셔틀이 없습니다.</p>
      </div>
    )
  }

  if (isFrequent) {
    return (
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">다음 셔틀까지</p>
          <p className="text-4xl font-bold leading-none text-navy">수시운행</p>
          {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-slate-900">수시 출발</p>
        </div>
      </div>
    )
  }

  if (isReturn) {
    const schoolTime = nextShuttle?.note?.match(/학교 (\d{2}:\d{2}) 출발/)?.[1] ?? null
    return (
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">다음 셔틀까지</p>
          <p className="text-2xl font-bold leading-snug text-navy">회차편 탑승</p>
          <p className="text-sm text-slate-500 mt-1.5 leading-snug">
            {schoolTime
              ? `${schoolTime}에 출발 후 도착하는 버스가 회차하면 탑승하세요`
              : '수시운행(17:00~18:00) 버스가 회차하면 탑승하세요'}
          </p>
          {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
        </div>
      </div>
    )
  }

  const hours = Math.floor((totalSeconds ?? 0) / 3600)
  const mins = Math.floor(((totalSeconds ?? 0) % 3600) / 60)
  const display = isExpired
    ? '곧 출발'
    : hours > 0
      ? `${hours}시간 ${String(mins).padStart(2, '0')}분`
      : `${mm}:${ss}`

  return (
    <div className="flex items-center justify-between bg-white border-b border-slate-200 px-5 py-4">
      <div>
        <p className="text-sm text-slate-500 mb-1">다음 셔틀까지</p>
        <p className={`time-num text-4xl font-bold leading-none ${isExpired ? 'text-accent' : isUrgent ? 'text-accent' : 'text-navy'}`}>
          {display}
        </p>
        {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
      </div>
      <div className="text-right">
        <p className="text-base font-bold text-slate-900">{departAt} 출발</p>
      </div>
    </div>
  )
}
