import { useMemo, useState, useRef, useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext, useSubwayRealtime } from '../../hooks/useSubway'
import { useApi } from '../../hooks/useApi'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'
import DualDirectionCard from '../common/DualDirectionCard'
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

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function SubwayPanel() {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const setSubwayDetailSheet = useAppStore((s) => s.setSubwayDetailSheet)
  const { data, loading, error, refetch } = useSubwayNext()
  const { data: realtimeAll, loading: realtimeLoading } = useSubwayRealtime()
  const realtimeArrivals = realtimeAll?.[selectedStation] ?? null

  const [modeTab, setModeTab] = useState('realtime')
  const didAutoSwitchRef = useRef(false)

  const lines = STATION_LINES[selectedStation] ?? []

  useEffect(() => {
    setModeTab('realtime')
    didAutoSwitchRef.current = false
  }, [selectedStation])

  useEffect(() => {
    if (realtimeLoading) return
    const isEmpty = !realtimeArrivals || realtimeArrivals.length === 0
    if (isEmpty && !didAutoSwitchRef.current) {
      didAutoSwitchRef.current = true
      setModeTab('timetable')
    } else if (realtimeArrivals && realtimeArrivals.length > 0 && didAutoSwitchRef.current) {
      didAutoSwitchRef.current = false
      setModeTab('realtime')
    }
  }, [realtimeArrivals, realtimeLoading])

  const tom1 = useMemo(() => offsetDate(1), [])
  const { data: tmrData } = useApi(`/subway/timetable?date=${tom1}`, { ttl: 43_200_000 })

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
      <div className="flex gap-1.5 mb-2">
        {['realtime', 'timetable'].map((mode) => (
          <button
            key={mode}
            onClick={() => setModeTab(mode)}
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              border: modeTab === mode ? '1.5px solid var(--tj-pill-active-bg)' : '1.5px solid var(--tj-line)',
              background: modeTab === mode ? 'var(--tj-pill-active-bg)' : 'transparent',
              color: modeTab === mode ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            }}
          >
            {mode === 'realtime' ? '실시간' : '시간표'}
          </button>
        ))}
      </div>

      {modeTab === 'realtime' && (
        realtimeLoading ? (
          <div className="space-y-2">
            <Skeleton height="5.5rem" rounded="rounded-xl" /><Skeleton height="5.5rem" rounded="rounded-xl" />
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

      {modeTab === 'timetable' && (
        <div className="space-y-2">
          {lines.map((line) => {
            const meta = LINE_META[line.name] ?? { symbol: line.name[0], color: '#6b7280', darkColor: '#6b7280', lightColor: '#f8f8f8' }
            const up = data[line.upKey]
            const down = data[line.downKey]
            const upFirst = isOvernight ? (up?.depart_at ?? null) : (tmrData?.[line.upKey]?.[0]?.depart_at ?? null)
            const downFirst = isOvernight ? (down?.depart_at ?? null) : (tmrData?.[line.downKey]?.[0]?.depart_at ?? null)

            return (
              <DualDirectionCard
                key={line.name}
                symbol={meta.symbol}
                symbolColor={meta.color}
                lineName={line.name}
                sub="다음 열차"
                left={trainToSlot(up, '상행', upFirst)}
                right={trainToSlot(down, '하행', downFirst)}
                onLeftClick={() => openDetail(line.name, '상행', line.upKey)}
                onRightClick={() => openDetail(line.name, '하행', line.downKey)}
                emptyTitle={emptyTitle}
                firstLabel={firstLabel}
              />
            )
          })}
        </div>
      )}
    </>
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
