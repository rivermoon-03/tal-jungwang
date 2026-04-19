import { useCountdown } from '../../hooks/useCountdown'

export default function ShuttleCountdown({ nextShuttle, direction, inFrequentWindow = false, inFrequentReturnWindow = false }) {
  const isFrequent         = inFrequentWindow
  const isReturn           = nextShuttle?.note?.startsWith('회차편') ?? false
  const isUpcomingFrequent = !inFrequentWindow && nextShuttle?.note === '수시운행'
  const departAt           = nextShuttle?.depart_at ?? null

  // 수시운행 구간 중간이면 타이머 불필요, 나머지는 모두 departAt까지 카운트다운
  const { mm, ss, totalSeconds, isUrgent, isExpired } = useCountdown(
    isFrequent || inFrequentReturnWindow ? null : departAt
  )

  if (!nextShuttle) {
    return (
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-5">
        <p className="text-base text-slate-500 dark:text-slate-400">오늘 남은 셔틀이 없습니다.</p>
      </div>
    )
  }

  if (isFrequent) {
    return (
      <div className="flex items-center justify-between bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-4">
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

  if (inFrequentReturnWindow) {
    return (
      <div className="flex items-center justify-between bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">다음 셔틀까지</p>
          <p className="text-4xl font-bold leading-none text-navy dark:text-blue-400">수시 회차 중</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
            수시운행 버스가 계속 회차하여 탑승 가능합니다
          </p>
          {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">수시 도착</p>
        </div>
      </div>
    )
  }

  const hours = Math.floor((totalSeconds ?? 0) / 3600)
  const mins  = Math.floor(((totalSeconds ?? 0) % 3600) / 60)

  if (isReturn) {
    const schoolTime = nextShuttle?.note?.match(/학교 (\d{2}:\d{2}) 출발/)?.[1] ?? null
    const returnDisplay = isExpired
      ? '곧 도착'
      : hours > 0
        ? `${hours}시간 ${String(mins).padStart(2, '0')}분`
        : `${mm}:${ss}`

    return (
      <div className="flex items-center justify-between bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">회차편 도착까지</p>
          <p className={`time-num text-4xl font-bold leading-none ${isExpired ? 'text-accent' : isUrgent ? 'text-accent' : 'text-navy dark:text-blue-400'}`}>
            {returnDisplay}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
            {schoolTime
              ? `${schoolTime}에 출발 후 도착하는 버스가 회차하면 탑승하세요`
              : '수시운행(17:00~18:00) 버스가 회차하면 탑승하세요'}
          </p>
          {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-navy dark:text-blue-400 border border-navy dark:border-blue-400 px-2 py-1 rounded">
            회차편
          </span>
        </div>
      </div>
    )
  }

  const display = isExpired
    ? '곧 출발'
    : hours > 0
      ? `${hours}시간 ${String(mins).padStart(2, '0')}분`
      : `${mm}:${ss}`

  const countdownLabel = isUpcomingFrequent ? '수시운행 시작까지' : '다음 셔틀까지'
  const departLabel    = isUpcomingFrequent ? `수시운행 ${departAt}~` : `${departAt} 출발`

  return (
    <div className="flex items-center justify-between bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark px-5 py-4">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{countdownLabel}</p>
        <p className={`time-num text-4xl font-bold leading-none ${isExpired ? 'text-accent' : isUrgent ? 'text-accent' : 'text-navy dark:text-blue-400'}`}>
          {display}
        </p>
        {direction && <p className="text-sm text-slate-400 mt-1">{direction}</p>}
      </div>
      <div className="text-right">
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{departLabel}</p>
      </div>
    </div>
  )
}
