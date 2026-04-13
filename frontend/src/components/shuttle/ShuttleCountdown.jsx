import { useCountdown } from '../../hooks/useCountdown'

export default function ShuttleCountdown({ nextShuttle, direction, inFrequentWindow = false }) {
  // 수시운행 구간 안에 실제로 있을 때만 수시운행 표시
  // (구간 이전에 다음 항목이 수시운행이어도 카운트다운을 표시)
  const isFrequent = inFrequentWindow
  const isReturn   = nextShuttle?.note?.startsWith('회차편') ?? false
  const departAt = nextShuttle?.depart_at ?? null

  const { mm, ss, totalSeconds, isUrgent, isExpired } = useCountdown(
    isFrequent || isReturn ? null : departAt
  )

  if (!nextShuttle) {
    return (
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-5">
        <p className="text-base text-slate-500 dark:text-slate-400">오늘 남은 셔틀이 없습니다.</p>
      </div>
    )
  }

  if (isFrequent) {
    return (
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">다음 셔틀까지</p>
          <p className="text-4xl font-bold leading-none text-navy dark:text-blue-400">수시운행</p>
          {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">수시 출발</p>
        </div>
      </div>
    )
  }

  if (isReturn) {
    const schoolTime = nextShuttle?.note?.match(/학교 (\d{2}:\d{2}) 출발/)?.[1] ?? null
    return (
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">다음 셔틀까지</p>
          <p className="text-2xl font-bold leading-snug text-navy dark:text-blue-400">회차편 탑승</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
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
    <div className="flex items-center justify-between bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">다음 셔틀까지</p>
        <p className={`time-num text-4xl font-bold leading-none ${isExpired ? 'text-accent' : isUrgent ? 'text-accent' : 'text-navy dark:text-blue-400'}`}>
          {display}
        </p>
        {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
      </div>
      <div className="text-right">
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{departAt} 출발</p>
      </div>
    </div>
  )
}
