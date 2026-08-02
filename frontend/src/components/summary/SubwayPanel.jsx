import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext, useSubwayRealtime, normalizeRealtimeStation } from '../../hooks/useSubway'
import { useApi } from '../../hooks/useApi'
import { SkeletonPanelRow } from '../common/Skeleton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import TransitCard from '../ui/TransitCard.jsx'
import { RealtimeCompactCard } from '../subway/SubwayRealtimeCard'

const LINE_META = {
  수인분당선: { symbol: '수', color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
  '4호선':    { symbol: '4', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
  서해선:     { symbol: '서', color: '#75BF43', darkColor: '#75bf43', lightColor: '#f2fde6' },
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

// 결함 #26 — 버스 패널(BusPanel.jsx)과 동일한 "5분 이하 = 임박(색만)" 규칙.
// utils/**가 읽기 전용이라 공용 상수로 승격하지 않고 각 파일에 로컬로 둔다.
const SOON_THRESHOLD_SEC = 5 * 60

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function SubwayPanel({ dataMode = 'timetable' }) {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const setSubwayDetailSheet = useAppStore((s) => s.setSubwayDetailSheet)
  const { data, loading, error, refetch } = useSubwayNext()
  const { data: realtimeAll, loading: realtimeLoading } = useSubwayRealtime()
  // envelope({items, stale, last_successful_realtime_at})에서 items만 추출.
  const { items: realtimeArrivals } = normalizeRealtimeStation(realtimeAll?.[selectedStation])

  const lines = STATION_LINES[selectedStation] ?? []

  const tom1 = useMemo(() => offsetDate(1), [])
  const { data: tmrData } = useApi(`/subway/timetable?date=${tom1}`, { ttl: 43_200_000 })

  if (loading) {
    return (
      <div className="space-y-2">
        <SkeletonPanelRow />
        {lines.length > 1 && <SkeletonPanelRow />}
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

  const isOvernight = new Date().getHours() < 5
  const emptyTitle = isOvernight ? '막차 끊김' : '오늘 운행 없음'
  const firstLabel = isOvernight ? '오늘 첫차' : '내일 첫차'

  const openDetail = (lineName, direction, timetableKey, realtimeTrain = null) => {
    const meta = LINE_META[lineName] ?? { symbol: lineName[0], color: '#6b7280' }
    setSubwayDetailSheet({
      station: selectedStation,
      lineName: lineName,
      timetableKey: timetableKey,
      direction: direction,
      color: meta.color,
      darkColor: meta.darkColor,
      lightColor: meta.lightColor,
      symbol: meta.symbol,
      realtimeTrain: realtimeTrain, // 실시간 열차 정보 포함
    })
  }

  return (
    <>
      {dataMode === 'realtime' && (
        realtimeLoading ? (
          <div className="space-y-2">
            <SkeletonPanelRow />
            {lines.length > 1 && <SkeletonPanelRow />}
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((line) => {
              const meta = LINE_META[line.name] ?? { symbol: line.name[0], color: '#6b7280' }
              const up = (realtimeArrivals ?? []).find((a) => a.line === line.name && a.direction === '상행') ?? null
              const down = (realtimeArrivals ?? []).find((a) => a.line === line.name && a.direction === '하행') ?? null
              return (
                <RealtimeCompactCard
                  key={line.name}
                  lineName={line.name}
                  symbol={meta.symbol}
                  color={meta.color}
                  upTrain={up}
                  downTrain={down}
                  onTrainClick={(train) => openDetail(line.name, train.direction, train.direction === '상행' ? line.upKey : line.downKey, train)}
                />
              )
            })}
          </div>
        )
      )}

      {/* 결함 #26 — 방향별 TransitCard로 교체(2열 정적 카드 + 진행바 폐기). 탭하면
          기존 전역 지하철 상세 시트(GlobalSubwayDetailSheet, useAppStore.subwayDetailSheet)를 그대로 연다. */}
      {dataMode === 'timetable' && (
        <div className="space-y-3">
          {lines.map((line) => {
            const meta = LINE_META[line.name] ?? { symbol: line.name[0], color: '#6b7280', darkColor: '#6b7280', lightColor: '#f8f8f8' }
            const up = data[line.upKey]
            const down = data[line.downKey]
            const upFirst = isOvernight ? (up?.depart_at ?? null) : (tmrData?.[line.upKey]?.[0]?.depart_at ?? null)
            const downFirst = isOvernight ? (down?.depart_at ?? null) : (tmrData?.[line.downKey]?.[0]?.depart_at ?? null)

            return (
              <div key={line.name} className="space-y-2">
                <SubwayDirectionCard
                  meta={meta}
                  train={up}
                  fallbackDir="상행"
                  firstTomorrow={upFirst}
                  emptyTitle={emptyTitle}
                  firstLabel={firstLabel}
                  onClick={() => openDetail(line.name, '상행', line.upKey)}
                />
                <SubwayDirectionCard
                  meta={meta}
                  train={down}
                  fallbackDir="하행"
                  firstTomorrow={downFirst}
                  emptyTitle={emptyTitle}
                  firstLabel={firstLabel}
                  onClick={() => openDetail(line.name, '하행', line.downKey)}
                />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * SubwayDirectionCard — 상행/하행 각각 독립된 TransitCard 한 장.
 * badge=노선 심볼(수인/4/서), title="OO 방면", subtitle=상행|하행,
 * eta.primary=N분(5분 이하만 imminent 색), secondary="다음 M분".
 */
function SubwayDirectionCard({ meta, train, fallbackDir, firstTomorrow, emptyTitle, firstLabel, onClick }) {
  const sec = trainToSeconds(train)
  const minutes = trainToMinutes(sec)
  const nextMinutes = trainToMinutes(train?.next_arrive_in_seconds)

  if (minutes == null && nextMinutes == null) {
    return (
      <TransitCard
        badge={{ label: meta.symbol, bgVar: meta.color }}
        title={emptyTitle}
        subtitle={fallbackDir}
        muted
        eta={{
          primary: { text: '운행 없음', tone: 'muted' },
          secondary: firstTomorrow ? { text: `${firstLabel} ${firstTomorrow}` } : undefined,
        }}
      />
    )
  }

  const imminent = sec != null && sec <= SOON_THRESHOLD_SEC
  const title = train?.destination ? `${train.destination} 방면` : fallbackDir

  // 막차 강조 — 지금 카드의 열차가 오늘 마지막이면 '막차' 칩. 아직 여러 대 남았어도
  // 저녁(21시 이후)엔 막차 시각을 보조줄에 상시 노출해 "언제까지 갈 수 있나"를
  // 카드에서 바로 읽게 한다.
  const isLast = train?.is_last === true
  const isEvening = new Date().getHours() >= 21
  const secondaryText = (() => {
    const parts = []
    if (nextMinutes != null) parts.push(`다음 ${nextMinutes}분`)
    if (!isLast && isEvening && train?.last_depart_at) parts.push(`막차 ${train.last_depart_at}`)
    return parts.length ? parts.join(' · ') : undefined
  })()

  return (
    <TransitCard
      badge={{ label: meta.symbol, bgVar: meta.color }}
      title={title}
      subtitle={fallbackDir}
      chips={isLast ? [{ label: '막차', tone: 'warn' }] : []}
      eta={{
        primary: { text: minutes != null ? `${minutes}분` : '정보 없음', tone: minutes == null ? 'muted' : imminent ? 'imminent' : 'default' },
        secondary: secondaryText ? { text: secondaryText } : undefined,
      }}
      onClick={onClick}
    />
  )
}

function trainToSeconds(train) {
  if (!train) return null
  return train.arrive_in_seconds ?? null
}

function trainToMinutes(seconds) {
  if (seconds == null) return null
  if (seconds > 3600) return null
  return Math.max(0, Math.ceil(seconds / 60))
}
