import ArrivalDistributionBar from './ArrivalDistributionBar'
import StatusChip from '../ui/StatusChip'

/**
 * BusStatsHeader — 평소 배차 간격.
 *
 * 대표값 하나를 크게 쓰지 않는다. 예전에는 "약 34분" 을 큰 숫자로 놓고 그 아래
 * 분포 막대에 26 / 30 / 47 을 함께 그렸는데, 34는 평균이라 막대의 어느 값과도
 * 달랐다. 사용자는 그 숫자가 어디서 왔는지 알 길이 없었다.
 *
 * 지금은 범위로 말한다. 한 대를 놓쳤을 때 최대 얼마를 기다리는지가 실제로
 * 행동을 바꾸는 정보라, 그 값을 문장으로 한 번 더 짚는다.
 */
export default function BusStatsHeader({ stats, dayLabel, hourLabel }) {
  if (!stats) return null
  const subtitleParts = []
  if (dayLabel) subtitleParts.push(dayLabel)
  if (hourLabel) subtitleParts.push(hourLabel)
  const subtitle = subtitleParts.join(' · ')

  const isLowSample = stats.is_low_sample === true
  const hasRange = stats.p10_min != null && stats.p90_min != null

  // 프레임 대신 구분선 한 줄로 ETA 블록과 나눈다(시간표 상세 표면 규율, 2026-08-02).
  return (
    <div className="mb-1">
      <div className="flex items-end justify-between mb-2.5 gap-3">
        <div className="min-w-0">
          <div className="text-label text-mute dark:text-mute font-semibold tracking-wide mb-0.5 flex items-center gap-1.5">
            <span>버스 사이 간격</span>
            {isLowSample && <StatusChip kind="last">기록 적음</StatusChip>}
          </div>
          {hasRange ? (
            <span className="inline-flex items-baseline gap-1 text-ink dark:text-white leading-none tabular-nums">
              <span className="text-eta">{stats.p10_min}</span>
              <span className="text-label text-mute dark:text-mute">~</span>
              <span className="text-eta">{stats.p90_min}</span>
              <span className="text-label text-mute dark:text-mute">분</span>
            </span>
          ) : (
            <span className="text-label text-mute dark:text-mute">알 수 없어요</span>
          )}
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
      <div className="mt-2 flex items-center justify-between gap-3 text-caption text-mute dark:text-mute">
        {hasRange ? (
          <span>한 대를 놓치면 최대 {stats.p90_min}분을 기다릴 수 있어요</span>
        ) : (
          <span>버스가 한 대 오고 다음 버스까지 걸리는 시간</span>
        )}
        {stats.sample_size != null && (
          <span className="shrink-0">최근 {stats.sample_size}번 기록</span>
        )}
      </div>
    </div>
  )
}
