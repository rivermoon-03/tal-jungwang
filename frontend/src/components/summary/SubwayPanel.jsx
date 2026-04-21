import { Moon } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'
import DualDirectionCard from '../common/DualDirectionCard'

/**
 * SubwayPanel — 지하철 모드 패널.
 *
 * 한 노선당 DualDirectionCard 1장.
 *   - 정왕역: 수인분당선 + 4호선 2장 스택
 *   - 초지·시흥시청: 서해선 1장
 */

const LINE_META = {
  수인분당선: { symbol: '수', color: '#F5A623' },
  '4호선':    { symbol: '4', color: '#1B5FAD' },
  서해선:     { symbol: '서', color: '#75BF43' },
}

const STATION_LINES = {
  정왕: [
    { name: '수인분당선', upKey: 'up',         downKey: 'down' },
    { name: '4호선',     upKey: 'line4_up',   downKey: 'line4_down' },
  ],
  초지: [
    { name: '서해선',    upKey: 'choji_up',   downKey: 'choji_dn' },
  ],
  시흥시청: [
    { name: '서해선',    upKey: 'siheung_up', downKey: 'siheung_dn' },
  ],
}

export default function SubwayPanel() {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const { data, loading, error, refetch } = useSubwayNext()

  const lines = STATION_LINES[selectedStation] ?? []

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton height="5.5rem" rounded="rounded-xl" />
        {lines.length > 1 && <Skeleton height="5.5rem" rounded="rounded-xl" />}
      </div>
    )
  }

  if (error) {
    return <ErrorState message="지하철 정보를 불러오지 못했어요" onRetry={refetch} />
  }

  if (!data || lines.length === 0) {
    return (
      <EmptyState
        title="정보 준비 중"
        desc={`${selectedStation}역 정보를 준비하고 있어요.`}
        className="py-6"
      />
    )
  }

  const hasAnyData = lines.some(
    (l) => data[l.upKey] != null || data[l.downKey] != null
  )

  if (!hasAnyData) {
    return (
      <EmptyState
        icon={<Moon size={24} strokeWidth={1.6} />}
        title="운행 종료"
        desc="내일 첫차 시간을 확인하세요"
        className="py-6"
      />
    )
  }

  const handleClick = () => {
    const url = `/schedule?mode=subway&station=${encodeURIComponent(selectedStation)}`
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="space-y-2">
      {lines.map((line) => {
        const meta = LINE_META[line.name] ?? { symbol: line.name.slice(0, 1), color: '#6b7280' }
        const up = data[line.upKey]
        const down = data[line.downKey]
        return (
          <DualDirectionCard
            key={line.name}
            symbol={meta.symbol}
            symbolColor={meta.color}
            lineName={line.name}
            sub="다음 열차"
            left={trainToSlot(up, '상행')}
            right={trainToSlot(down, '하행')}
            onClick={handleClick}
          />
        )
      })}
    </div>
  )
}

/**
 * 지하철 train 객체 → DirectionSlot.
 * - train이 없거나 도착 정보가 없으면 variant='empty'.
 * - destination 있으면 "destination 방면" 라벨을 route로.
 * - arrive_in_seconds를 분으로, next_arrive_in_seconds를 nextMinutes로.
 */
function trainToSlot(train, fallbackDir) {
  if (!train) return { variant: 'empty' }
  const minutes = trainToMinutes(train.arrive_in_seconds)
  const nextMinutes = trainToMinutes(train.next_arrive_in_seconds)
  if (minutes == null && nextMinutes == null) return { variant: 'empty' }
  const route = train.destination ? `${train.destination} 방면` : fallbackDir
  return {
    variant: 'normal',
    dir: fallbackDir,
    route,
    minutes,
    nextMinutes,
    isUrgent: minutes != null && minutes <= 3,
  }
}

/**
 * arrive_in_seconds → 남은 분(ceil). 60분 초과면 drift 방지 차원에서 null.
 */
function trainToMinutes(seconds) {
  if (seconds == null) return null
  if (seconds > 3600) return null
  return Math.max(0, Math.ceil(seconds / 60))
}
