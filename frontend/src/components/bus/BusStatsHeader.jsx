import ArrivalDistributionBar from './ArrivalDistributionBar'

export default function BusStatsHeader({ stats, dayLabel, hourLabel }) {
  if (!stats) return null
  const subtitleParts = []
  if (dayLabel) subtitleParts.push(dayLabel)
  if (hourLabel) subtitleParts.push(hourLabel)
  const subtitle = subtitleParts.join(' · ')

  const isLowSample = stats.is_low_sample === true

  return (
    <div className="rounded-card bg-surface-alt dark:bg-surface-dark-alt border border-line dark:border-line-dark p-3.5 mb-4">
      <div className="flex items-end justify-between mb-2.5 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] text-mute dark:text-mute-dark font-semibold tracking-wide mb-0.5 flex items-center gap-1.5">
            <span>평소 배차 간격</span>
            {isLowSample && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 tracking-normal">
                데이터 부족
              </span>
            )}
          </div>
          <span className="text-eta-mob font-black text-ink dark:text-white leading-none tabular-nums">
            약 {stats.mean_min}분
          </span>
        </div>
        {subtitle && (
          <span className="text-[11px] text-mute dark:text-mute-dark shrink-0 pb-0.5">{subtitle}</span>
        )}
      </div>
      <ArrivalDistributionBar
        p10Min={stats.p10_min}
        p50Min={stats.p50_min}
        p90Min={stats.p90_min}
        variant="full"
      />
      <div className="mt-2 flex items-center justify-between text-[10px] text-mute dark:text-mute-dark">
        <span>버스가 한 대 오고 다음 버스까지 걸리는 시간</span>
        <span>표본 {stats.sample_size}회</span>
      </div>
    </div>
  )
}
