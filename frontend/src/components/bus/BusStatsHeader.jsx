import ArrivalDistributionBar from './ArrivalDistributionBar'
import StatusChip from '../ui/StatusChip'

export default function BusStatsHeader({ stats, dayLabel, hourLabel }) {
  if (!stats) return null
  const subtitleParts = []
  if (dayLabel) subtitleParts.push(dayLabel)
  if (hourLabel) subtitleParts.push(hourLabel)
  const subtitle = subtitleParts.join(' · ')

  const isLowSample = stats.is_low_sample === true

  return (
    <div className="rounded-card bg-surface-2 dark:bg-bg border border-line dark:border-line p-3.5 mb-4">
      <div className="flex items-end justify-between mb-2.5 gap-3">
        <div className="min-w-0">
          <div className="text-label text-mute dark:text-mute font-semibold tracking-wide mb-0.5 flex items-center gap-1.5">
            <span>평소 배차 간격</span>
            {isLowSample && (
              <StatusChip kind="last">데이터 부족</StatusChip>
            )}
          </div>
          <span className="text-eta-mob font-bold text-ink dark:text-white leading-none tabular-nums">
            약 {stats.mean_min}분
          </span>
        </div>
        {subtitle && (
          <span className="text-caption text-mute dark:text-mute shrink-0 pb-0.5">{subtitle}</span>
        )}
      </div>
      <ArrivalDistributionBar
        p10Min={stats.p10_min}
        p50Min={stats.p50_min}
        p90Min={stats.p90_min}
        variant="full"
      />
      <div className="mt-2 flex items-center justify-between text-caption text-mute dark:text-mute">
        <span>버스가 한 대 오고 다음 버스까지 걸리는 시간</span>
        <span>표본 {stats.sample_size}회</span>
      </div>
    </div>
  )
}
