import { Moon } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'
import ArrivalRow from '../dashboard/ArrivalRow'

/**
 * 역별 데이터 키 매핑
 *   정왕: 수인분당선(up/down) + 4호선(line4_up/line4_down)
 *   초지: 서해선(choji_up/choji_dn)
 *   시흥시청: 서해선(siheung_up/siheung_dn)
 *
 * 각 행은 "상행"과 "하행" 두 개를 만들기 위해 루프에서 전개된다.
 */
const STATION_LINES = {
  정왕: [
    { name: '수인분당선', upKey: 'up',         downKey: 'down',       color: '#F5A623' },
    { name: '4호선',     upKey: 'line4_up',   downKey: 'line4_down', color: '#1B5FAD' },
  ],
  초지: [
    { name: '서해선',    upKey: 'choji_up',   downKey: 'choji_dn',   color: '#75bf43' },
  ],
  시흥시청: [
    { name: '서해선',    upKey: 'siheung_up', downKey: 'siheung_dn', color: '#75bf43' },
  ],
}

export default function SubwayPanel() {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const { data, loading, error, refetch } = useSubwayNext()

  const lines = STATION_LINES[selectedStation] ?? []
  const hasAnyData = data && lines.some(
    (l) => data[l.upKey] != null || data[l.downKey] != null
  )

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton height="2.75rem" rounded="rounded-xl" />
        <Skeleton height="2.75rem" rounded="rounded-xl" />
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

  // 각 노선별 상행/하행을 세로 2행 ArrivalRow로 전개
  const rows = []
  for (const line of lines) {
    const up = data[line.upKey]
    const down = data[line.downKey]
    rows.push({
      key: `${line.upKey}-up`,
      color: line.color,
      name: line.name,
      dir: '상행',
      train: up,
    })
    rows.push({
      key: `${line.downKey}-down`,
      color: line.color,
      name: line.name,
      dir: '하행',
      train: down,
    })
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const minutes = trainToMinutes(row.train)
        const destination = row.train?.destination
        const direction = destination
          ? `${row.dir} · ${destination}`
          : row.dir
        return (
          <ArrivalRow
            key={row.key}
            routeColor={row.color}
            routeNumber={row.name}
            direction={direction}
            minutes={minutes}
            isUrgent={minutes != null && minutes <= 3}
            onClick={handleClick}
          />
        )
      })}
    </div>
  )
}

/**
 * 지하철 train 객체 → 남은 분(ceil).
 * arrive_in_seconds는 백엔드 계산치. 60분(3600초) 초과이면 drift 방지 차원에서 null 반환.
 */
function trainToMinutes(train) {
  if (!train) return null
  if (train.arrive_in_seconds == null) return null
  if (train.arrive_in_seconds > 3600) return null
  return Math.max(0, Math.ceil(train.arrive_in_seconds / 60))
}
