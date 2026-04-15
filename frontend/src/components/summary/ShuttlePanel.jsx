import { TramFront } from 'lucide-react'
import { useShuttleNext } from '../../hooks/useShuttle'
import Skeleton from '../common/Skeleton'
import EmptyState from '../common/EmptyState'
import ErrorState from '../common/ErrorState'
import { formatArrival } from '../../utils/arrivalTime'

/**
 * ShuttlePanel — 셔틀 모드 패널
 * 등교(direction=0) / 하교(direction=1) 양방향 카드 동시 표시
 * 현재 시간대 방향은 coral 테두리 강조
 *
 * useShuttleNext() 반환 shape (추정):
 *   data: { next: { time, minutesLeft }, afterNext: { time, minutesLeft } } | null
 */
export default function ShuttlePanel() {
  const now = new Date()
  const hour = now.getHours()
  // 07–14시: 등교가 기본, 나머지: 하교가 기본
  const activeDirection = hour >= 7 && hour < 14 ? 0 : 1

  return (
    <div className="grid grid-cols-2 gap-3">
      <ShuttleCard direction={0} label="등교" isActive={activeDirection === 0} />
      <ShuttleCard direction={1} label="하교" isActive={activeDirection === 1} />
    </div>
  )
}

function ShuttleCard({ direction, label, isActive }) {
  const { data, loading, error, refetch } = useShuttleNext(direction)

  return (
    <div
      className={`rounded-card p-3 bg-white dark:bg-surface-dark shadow-card border-2 transition-colors
        ${isActive ? 'border-coral' : 'border-gray-100 dark:border-border-dark'}`}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 mb-2">
        <TramFront
          size={14}
          className={isActive ? 'text-coral' : 'text-gray-400'}
          aria-hidden="true"
        />
        <span className={`text-xs font-bold ${isActive ? 'text-coral' : 'text-gray-500 dark:text-gray-400'}`}>
          {label}
        </span>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <Skeleton height="1.75rem" rounded="rounded-lg" />
          <Skeleton height="1rem" rounded="rounded-lg" />
        </div>
      ) : error ? (
        <ErrorState message="오류" onRetry={refetch} className="py-2" />
      ) : !data?.depart_at ? (
        <EmptyState title="🌙 오늘 운행 종료" className="py-2" />
      ) : (
        <div className="space-y-1">
          <ShuttleRow entry={data} isNext />
          {data.is_last && (
            <p className="text-[10px] text-gray-400 mt-0.5">오늘 마지막 셔틀</p>
          )}
        </div>
      )}
    </div>
  )
}

function ShuttleRow({ entry, isNext = false }) {
  // 백엔드 응답: { depart_at: "HH:MM:SS", arrive_in_seconds: int, is_last: bool }
  // arrive_in_seconds가 60분 초과이면 Date.now() drift 방지를 위해 depart_at 직접 사용
  const minsLabel = entry.arrive_in_seconds != null && entry.arrive_in_seconds <= 3600
    ? formatArrival(entry.arrive_in_seconds)
    : null
  // depart_at을 "HH:MM"으로 자름
  const timeLabel = entry.depart_at ? entry.depart_at.slice(0, 5) : '–'

  return (
    <div className="flex items-baseline justify-between">
      <span className={`font-black leading-none ${isNext ? 'text-xl text-gray-900 dark:text-gray-50' : 'text-sm text-gray-500 dark:text-gray-400'}`}>
        {minsLabel ?? timeLabel}
      </span>
      {minsLabel && minsLabel !== timeLabel && (
        <span className="text-[10px] text-gray-400 ml-1">{timeLabel}</span>
      )}
    </div>
  )
}
