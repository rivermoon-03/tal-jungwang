import { Moon } from 'lucide-react'
import { useShuttleNext } from '../../hooks/useShuttle'
import Skeleton from '../common/Skeleton'
import EmptyState from '../common/EmptyState'
import ErrorState from '../common/ErrorState'
import ArrivalRow from '../dashboard/ArrivalRow'

/**
 * ShuttlePanel — 셔틀 모드 패널
 * 등교(direction=0) / 하교(direction=1) 세로 2행 ArrivalRow.
 * 시간 기반 "현재 활성 방향" 코랄 강조는 제거 — urgent(≤3분) 좌측 바만 사용.
 */

export default function ShuttlePanel() {
  return (
    <div className="space-y-2">
      <ShuttleRow direction={0} label="등교" />
      <ShuttleRow direction={1} label="하교" />
    </div>
  )
}

// 백엔드가 "해당 날짜에 운행이 없음"을 의미할 때 돌려주는 오류 코드.
// 이들은 에러가 아닌 운행 종료/미운행 Empty 상태로 표시한다.
const NO_RUN_CODES = new Set(['NO_SHUTTLE', 'NO_SCHEDULE'])

function ShuttleRow({ direction, label }) {
  const { data, loading, error, refetch } = useShuttleNext(direction)

  if (loading) {
    return <Skeleton height="2.75rem" rounded="rounded-xl" />
  }

  const isNoRun = error && NO_RUN_CODES.has(error.code)

  if (error && !isNoRun) {
    return <ErrorState message={`${label} 정보 오류`} onRetry={refetch} className="py-2" />
  }

  if (isNoRun || !data?.depart_at) {
    return (
      <EmptyState
        icon={<Moon size={24} strokeWidth={1.6} />}
        title="오늘 운행 없음"
        className="py-2"
      />
    )
  }

  const isReturnTrip = !!(data.note?.includes('회차편'))
  const departTime = data.depart_at?.slice(0, 5) ?? null
  const minutes = isReturnTrip
    ? null
    : data.arrive_in_seconds != null
      ? Math.max(0, Math.ceil(data.arrive_in_seconds / 60))
      : null

  const handleClick = () => {
    const url = `/schedule?mode=shuttle&dir=${direction}`
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <ArrivalRow
      route={`${label}셔틀`}
      minutes={minutes}
      isUrgent={!isReturnTrip && minutes != null && minutes <= 3}
      returnTrip={isReturnTrip}
      rightAddon={isReturnTrip && departTime
        ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
              하교 버스가
            </div>
            <div style={{ fontSize: 13, color: '#b45309', fontWeight: 900, whiteSpace: 'nowrap' }}>
              {departTime} 출발
            </div>
          </div>
        )
        : null}
      onClick={handleClick}
    />
  )
}
