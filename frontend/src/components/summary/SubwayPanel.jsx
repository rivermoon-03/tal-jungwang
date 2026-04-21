import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext } from '../../hooks/useSubway'
import { useApi } from '../../hooks/useApi'
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
 *
 * 운행 종료 시 내일 첫차 시간 표시.
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

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function SubwayPanel() {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const setScheduleHint = useAppStore((s) => s.setScheduleHint)
  const { data, loading, error, refetch } = useSubwayNext()

  const lines = STATION_LINES[selectedStation] ?? []

  // 내일 시간표 — 운행 종료 시 첫차 표시용 (12h TTL, 항상 prefetch)
  const tom1 = useMemo(() => offsetDate(1), [])
  const { data: tmrData } = useApi(
    `/subway/timetable?date=${tom1}`,
    { ttl: 43_200_000 }
  )

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

  // 자정~첫차 사이(hour < 5): 막차가 끊긴 상태. 다음 열차는 오늘 시간표 기준 첫차.
  const isOvernight = new Date().getHours() < 5
  const emptyTitle = isOvernight ? '막차 끊김' : '오늘 운행 없음'
  const firstLabel = isOvernight ? '오늘 첫차' : '내일 첫차'

  const handleClick = () => {
    setScheduleHint({ mode: 'subway', group: selectedStation })
    window.history.pushState({}, '', '/schedule')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="space-y-2">
      {lines.map((line) => {
        const meta = LINE_META[line.name] ?? { symbol: line.name.slice(0, 1), color: '#6b7280' }
        const up = data[line.upKey]
        const down = data[line.downKey]
        // 자정~새벽: useSubwayNext가 오늘 첫차를 이미 반환하지만 trainToMinutes가 >1h 차단.
        // 해당 데이터의 depart_at을 직접 사용. 평시엔 내일 시간표에서 첫차를 가져온다.
        const upFirst = isOvernight
          ? (up?.depart_at ?? null)
          : (tmrData?.[line.upKey]?.[0]?.depart_at ?? null)
        const downFirst = isOvernight
          ? (down?.depart_at ?? null)
          : (tmrData?.[line.downKey]?.[0]?.depart_at ?? null)
        return (
          <DualDirectionCard
            key={line.name}
            symbol={meta.symbol}
            symbolColor={meta.color}
            lineName={line.name}
            sub="다음 열차"
            left={trainToSlot(up, '상행', upFirst)}
            right={trainToSlot(down, '하행', downFirst)}
            onClick={handleClick}
            emptyTitle={emptyTitle}
            firstLabel={firstLabel}
          />
        )
      })}
    </div>
  )
}

function trainToSlot(train, fallbackDir, firstTomorrow = null) {
  if (!train) return { variant: 'empty', dir: fallbackDir, firstTomorrow }
  const minutes = trainToMinutes(train.arrive_in_seconds)
  const nextMinutes = trainToMinutes(train.next_arrive_in_seconds)
  if (minutes == null && nextMinutes == null) return { variant: 'empty', dir: fallbackDir, firstTomorrow }
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

function trainToMinutes(seconds) {
  if (seconds == null) return null
  if (seconds > 3600) return null
  return Math.max(0, Math.ceil(seconds / 60))
}
