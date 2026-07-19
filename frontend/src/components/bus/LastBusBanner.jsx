import { TriangleAlert } from 'lucide-react'
import { getLastBusStatus } from '../../utils/lastBus.js'

/**
 * LastBusBanner — 막차가 30분 이내로 임박했을 때만 렌더되는 경고 배너.
 *
 * Props:
 *   entries     (Array<{depart_at, is_last?}>) 해당 노선의 "오늘" 시간표
 *   routeLabel  (string) 배너 문구에 붙는 노선 이름(예: "시흥33")
 *   now         (Date) 판정 기준 시각 — 테스트용, 생략 시 현재 시각
 *   compact     (boolean) ArrivalRow 위에 얹는 좁은 변형(패딩/폰트 축소)
 *   className   (string) extra classes
 *
 * 막차가 이미 지났거나 30분보다 여유가 있으면 아무것도 렌더하지 않는다(null).
 */
export default function LastBusBanner({
  entries,
  routeLabel = '',
  now,
  compact = false,
  className = '',
}) {
  const status = getLastBusStatus(entries, now)
  if (!status.isLast || status.minutesLeft == null || status.minutesLeft > 30) {
    return null
  }

  return (
    <div
      role="status"
      className={[
        'flex items-center gap-2.5 rounded-card border border-delayed bg-delayed-bg',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'flex-none flex items-center justify-center rounded-badge bg-delayed text-white',
          compact ? 'w-6 h-6' : 'w-8 h-8',
        ].join(' ')}
      >
        <TriangleAlert size={compact ? 13 : 16} strokeWidth={2.6} />
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={
            compact
              ? 'text-caption font-bold text-delayed leading-tight truncate'
              : 'text-body font-bold text-delayed leading-tight truncate'
          }
        >
          {routeLabel ? `${routeLabel} 오늘 막차` : '오늘 막차'}
        </p>
        <p
          className={
            compact
              ? 'text-[11px] font-semibold text-delayed/80 mt-0.5 tabular-nums'
              : 'text-caption font-semibold text-delayed/80 mt-0.5 tabular-nums'
          }
        >
          {status.departure} 출발 · {status.minutesLeft}분 남음
        </p>
      </div>
    </div>
  )
}
