/**
 * SchedulePage — 시간표 탭
 * - 상단 mode pill: 버스 · 지하철 · 셔틀 (바로 전환)
 * - 각 모드별 그룹 pill selector (지하철: 정왕/초지/시흥시청, 버스: 하교/등교/기타)
 */
import { useState, useEffect, useRef } from 'react'
import ScheduleSection from './ScheduleSection'
import ScheduleDetailModal from './ScheduleDetailModal'
import PageHeader from '../layout/PageHeader'
import SegmentTabs from '../common/SegmentTabs'
import RouteBadge from '../common/RouteBadge'
import Skeleton from '../common/Skeleton'
import { CrowdedBadge } from '../bus/BusArrivalCard'
import useAppStore from '../../stores/useAppStore'
import { useBusTimetable, useBusTimetableByRoute, useBusArrivals, useBusRoutesByCategory } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext, useSubwayTimetable, useSubwayRealtime } from '../../hooks/useSubway'
import { RealtimeCompactCard } from '../subway/SubwayRealtimeCard'
import { useMapMarkers } from '../../hooks/useMapMarkers'
import { getFirstBusLabel } from '../../utils/arrivalTime'
import { getGbisStationIdForRoute } from '../dashboard/busStationConfig'

// ─── map marker lookup ──────────────────────────────────────────────────────
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function findMarkerCoord(markers, routeNumber, stopId, stopLat, stopLng) {
  if (!markers?.length) return null
  if (stopId != null && routeNumber) {
    for (const m of markers) {
      for (const r of m.routes ?? []) {
        if (
          r.route_number === routeNumber &&
          (r.outbound_stop_id === stopId || r.inbound_stop_id === stopId)
        ) {
          return { lat: Number(m.lat), lng: Number(m.lng) }
        }
      }
    }
  }
  if (stopLat != null && stopLng != null) {
    let best = null
    let bestD = Infinity
    for (const m of markers) {
      if (m.type !== 'bus' && m.type !== 'bus_seoul') continue
      const d = distanceMeters(stopLat, stopLng, Number(m.lat), Number(m.lng))
      if (d < bestD && d <= 1000) {
        bestD = d
        best = m
      }
    }
    if (best) return { lat: Number(best.lat), lng: Number(best.lng) }
  }
  return null
}

// ─── url query helpers ─────────────────────────────────────────────────────
function readQuery() {
  if (typeof window === 'undefined') return { type: null, route: null, stop: null }
  const params = new URLSearchParams(window.location.search)
  return {
    type:  params.get('type'),
    route: params.get('route'),
    stop:  params.get('stop'),
  }
}

function navigateSchedule({ type = null, route = null, stop = null } = {}) {
  const params = new URLSearchParams()
  if (type)  params.set('type',  type)
  if (route) params.set('route', route)
  if (stop)  params.set('stop',  stop)
  const qs = params.toString()
  const url = qs ? `/schedule?${qs}` : '/schedule'
  window.history.replaceState({}, '', url)
}

// ─── static section definitions ────────────────────────────────────────────
const BUS_GROUP_IDS = [
  { id: '하교', label: '하교' },
  { id: '등교', label: '등교' },
  { id: '기타', label: '기타' },
]

const SUBWAY_GROUPS = [
  { id: '정왕',     label: '정왕',     stationCode: 'K449' },
  { id: '초지',     label: '초지',     stationCode: 'K448' },
  { id: '시흥시청', label: '시흥시청', stationCode: 'K447' },
]

const SHUTTLE_CAMPUS_GROUPS = [
  { id: 'main',   label: '본캠' },
  { id: 'second', label: '2캠' },
]

const SHUTTLE_CAMPUS_DIRECTIONS = {
  main:   [{ id: '등교', label: '등교', direction: 0 }, { id: '하교', label: '하교', direction: 1 }],
  second: [{ id: '등교', label: '등교', direction: 2 }, { id: '하교', label: '하교', direction: 3 }],
}

// ─── mode label config ───────────────────────────────────────────────────────
const MODES = [
  { id: 'bus',     label: '버스'   },
  { id: 'subway',  label: '지하철' },
  { id: 'shuttle', label: '셔틀'   },
]

function isValidMode(v) {
  return v === 'bus' || v === 'subway' || v === 'shuttle'
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function timeStrToMinutes(timeStr, now) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  const diff = Math.round((d - now) / 60000)
  if (diff < 0 || diff > 12 * 60) return null
  return diff
}

function withHaeng(label) {
  if (!label) return label
  if (/방면/.test(label)) return label.replace(/\s*방면/g, '행')
  return label.endsWith('행') ? label : `${label}행`
}

// ─── per-route bus section ───────────────────────────────────────────────────
function BusRouteSection({ busGroup, routeCode, routeId, stopId, favCode, destLabel, originLabel, mapLat, mapLng, isRealtime, onCardClick }) {
  const now = new Date()
  const dest = busGroup === '하교' ? withHaeng(destLabel) : destLabel
  const titleText = originLabel
    ? (dest ? `${originLabel} 출발 · ${dest}` : `${originLabel} 출발`)
    : (dest ?? routeCode)

  const stationId = isRealtime ? getGbisStationIdForRoute(routeCode) : null
  const { data: timetableByIdData, loading: timetableByIdLoading } = useBusTimetable(routeId ?? null)
  const { data: timetableByRouteData, loading: timetableByRouteLoading } = useBusTimetableByRoute(
    routeId == null ? routeCode : null,
    stopId ? { stopId } : undefined,
  )
  const timetableData = routeId != null ? timetableByIdData : timetableByRouteData
  const timetableLoading = routeId != null ? timetableByIdLoading : timetableByRouteLoading
  const { data: arrivalsData, loading: arrivalsLoading } = useBusArrivals(stationId)

  if (isRealtime) {
    const list = Array.isArray(arrivalsData) ? arrivalsData : arrivalsData?.arrivals ?? []
    const matches = list
      .filter((a) => a.route_no === routeCode && a.arrival_type === 'realtime')
      .sort((a, b) => (a.arrive_in_seconds ?? 0) - (b.arrive_in_seconds ?? 0))
    const first = matches[0]
    const second = matches[1]
    const firstMin = first?.arrive_in_seconds != null
      ? Math.max(0, Math.round(first.arrive_in_seconds / 60))
      : null
    const secondMin = second?.arrive_in_seconds != null
      ? Math.max(0, Math.round(second.arrive_in_seconds / 60))
      : null

    let nextLabel
    if (firstMin == null) {
      nextLabel = null
    } else if (firstMin <= 0) nextLabel = '곧 도착'
    else nextLabel = { minutes: firstMin, hhmm: null }

    const afterNextLabel = secondMin == null
      ? null
      : secondMin <= 0
        ? '곧 도착'
        : { minutes: secondMin, hhmm: null }

    const favKey = favCode ?? routeCode
    return (
      <ScheduleSection
        title={titleText}
        subtitle={firstMin == null ? '정보 없음' : (first?.destination ? `실시간 · ${withHaeng(first.destination)}` : '실시간')}
        type="bus"
        routeCode={routeCode}
        destLabel={null}
        next={nextLabel}
        afterNext={afterNextLabel}
        minutesUntil={firstMin}
        loading={arrivalsLoading && matches.length === 0}
        crowded={first?.crowded ?? 0}
        testBadge
        onClick={() => onCardClick({
          type: 'bus',
          routeCode,
          routeId,
          stopId,
          favCode: favKey,
          mapLat,
          mapLng,
          isRealtime: true,
          title: destLabel ? `${routeCode} · ${destLabel}` : `${routeCode}번 버스`,
          accentColor: (['3400', '5200', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
        })}
      />
    )
  }

  const allTimes = timetableData?.times ?? []
  const future = allTimes
    .map((t) => {
      const [h, m] = (t ?? '00:00').split(':').map(Number)
      const today = new Date(now)
      today.setHours(h, m, 0, 0)
      if (today > now) return today

      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(h, m, 0, 0)
      return tomorrow
    })
    .filter((d) => (d - now) < 12 * 60 * 60 * 1000)
    .sort((a, b) => a - b)

  const toStr = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null

  const nextMin = !future[0] ? null : Math.round((future[0] - now) / 60000)
  const _hour = now.getHours()
  const isTomorrow = future[0] != null && future[0].getDate() !== now.getDate()
  // 막차 지남 + 아직 자정 전(또는 새벽 5시 이후): 금일 종료
  const isEndOfDay = isTomorrow && _hour >= 5
  // 자정 ~ 새벽 4시: 첫차까지 카운트다운
  const isLateNightGap = isTomorrow && _hour < 5

  let nextStr, mins
  if (isEndOfDay) {
    nextStr = '금일 종료'
    mins = null
  } else if (isLateNightGap) {
    nextStr = getFirstBusLabel(allTimes, now)
    mins = nextMin
  } else {
    const hhmm = toStr(future[0])
    nextStr = hhmm ? { minutes: nextMin, hhmm } : getFirstBusLabel(allTimes, now)
    mins = nextMin
  }
  const secondHhmm = isEndOfDay ? toStr(future[0]) : toStr(future[1])
  const secondMin = !isEndOfDay && future[1] ? Math.round((future[1] - now) / 60000) : null
  const afterNextVal = secondHhmm
    ? (secondMin != null ? { minutes: secondMin, hhmm: secondHhmm } : secondHhmm)
    : null

  // 지금 잡힌 버스가 오늘의 마지막 차인지
  const isLastBus = !isEndOfDay && !isLateNightGap && future[0] != null &&
    (future[1] == null || future[1].getDate() !== now.getDate())

  const favKey = favCode ?? routeCode
  return (
    <ScheduleSection
      title={titleText}
      subtitle={destLabel ? null : '버스'}
      type="bus"
      routeCode={routeCode}
      destLabel={null}
      next={nextStr}
      afterNext={afterNextVal}
      minutesUntil={mins}
      endOfDay={isEndOfDay}
      lastBus={isLastBus}
      onClick={() => onCardClick({
        type: 'bus',
        routeCode,
        routeId,
        stopId,
        favCode: favKey,
        mapLat,
        mapLng,
        title: destLabel ? `${routeCode} · ${destLabel}` : `${routeCode}번 버스`,
        accentColor: (['3400', '5200', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
      })}
      loading={timetableLoading}
    />
  )
}

// ─── subway direction config per station ─────────────────────────────────────
const SUBWAY_DIRECTIONS = {
  정왕: [
    { subtitle: '수인분당선', symbol: '수', upKey: 'up',       downKey: 'down',       upLabel: '상행', downLabel: '하행', color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
    { subtitle: '4호선',     symbol: '4',  upKey: 'line4_up', downKey: 'line4_down', upLabel: '상행', downLabel: '하행', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
  ],
  초지: [
    { subtitle: '서해선', symbol: '서', upKey: 'choji_up',   downKey: 'choji_dn',   upLabel: '상행', downLabel: '하행', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
  ],
  시흥시청: [
    { subtitle: '서해선', symbol: '서', upKey: 'siheung_up', downKey: 'siheung_dn', upLabel: '상행', downLabel: '하행', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
  ],
}

// ─── subway section ──────────────────────────────────────────────────────────
function SubwaySection({ stationGroup, onCardClick, favoritesOnly = false, favCodes = [] }) {
  const { data, loading } = useSubwayNext()
  const { data: timetable } = useSubwayTimetable()
  const { data: realtimeAll, loading: realtimeLoading } = useSubwayRealtime()
  const realtimeArrivals = realtimeAll?.[stationGroup] ?? null
  const setSubwayLineSheet = useAppStore((s) => s.setSubwayLineSheet)
  const setSubwayDetailSheet = useAppStore((s) => s.setSubwayDetailSheet)
  const [modeTab, setModeTab] = useState('realtime')
  const didAutoSwitchRef = useRef(false)
  const directions = SUBWAY_DIRECTIONS[stationGroup] ?? []
  const now = new Date()

  useEffect(() => {
    setModeTab('realtime')
    didAutoSwitchRef.current = false
  }, [stationGroup])

  useEffect(() => {
    if (!realtimeLoading && realtimeArrivals !== null) {
      if (realtimeArrivals.length === 0 && !didAutoSwitchRef.current) {
        didAutoSwitchRef.current = true
        setModeTab('timetable')
      } else if (realtimeArrivals.length > 0) {
        didAutoSwitchRef.current = false
      }
    }
  }, [realtimeArrivals, realtimeLoading])

  function secondDepartStr(key) {
    const list = timetable?.[key]
    if (!Array.isArray(list) || list.length === 0) return null
    const future = list
      .map((e) => {
        const ts = (e?.depart_at ?? '').slice(0, 5)
        if (!ts) return null
        const [h, m] = ts.split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return null
        const d = new Date(now)
        d.setHours(h, m, 0, 0)
        if (d <= now) return null
        return { ts, d }
      })
      .filter(Boolean)
      .sort((a, b) => a.d - b.d)
    return future[1]?.ts ?? null
  }

  if (directions.length === 0) {
    return (
      <ScheduleSection
        title={stationGroup}
        subtitle="지하철"
        type="subway"
        routeCode={stationGroup}
        next={null}
        afterNext={null}
        loading={false}
        disabled
        disabledLabel="정보 준비 중"
      />
    )
  }

  const toggleStyle = (active) => ({
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: active ? '1.5px solid var(--tj-pill-active-bg)' : '1.5px solid var(--tj-line)',
    background: active ? 'var(--tj-pill-active-bg)' : 'transparent',
    color: active ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  })

  return (
    <>
      {/* 실시간/시간표 토글 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['realtime', 'timetable'].map((m) => (
          <button key={m} onClick={() => setModeTab(m)} style={toggleStyle(modeTab === m)}>
            {m === 'realtime' ? '실시간' : '시간표'}
          </button>
        ))}
      </div>

      {/* 실시간 모드 */}
      {modeTab === 'realtime' && (
        realtimeLoading ? (
          <>
            <div style={{ height: 90, borderRadius: 12, background: 'var(--tj-line)', opacity: 0.4 }} />
            <div style={{ height: 90, borderRadius: 12, background: 'var(--tj-line)', opacity: 0.4 }} />
          </>
        ) : (
          directions.map((dir) => {
            const up = (realtimeArrivals ?? []).find((a) => a.line === dir.subtitle && a.direction === '상행') ?? null
            const down = (realtimeArrivals ?? []).find((a) => a.line === dir.subtitle && a.direction === '하행') ?? null
            return (
              <RealtimeCompactCard
                key={dir.subtitle}
                lineName={dir.subtitle}
                symbol={dir.symbol}
                color={dir.color}
                upTrain={up}
                downTrain={down}
                onTrainClick={(item) => setSubwayLineSheet({ ...item, viewStation: stationGroup })}
              />
            )
          })
        )
      )}

      {/* 시간표 모드 */}
      {modeTab === 'timetable' && directions.flatMap((dir) => [
        ...[
          { key: dir.upKey, label: dir.upLabel },
          { key: dir.downKey, label: dir.downLabel },
        ].map(({ key, label }) => {
          const entry = data?.[key]
          const depart = entry?.depart_at ?? null
          const mins = depart ? timeStrToMinutes(depart, now) : null
          const validMins = mins != null && mins >= 0 ? mins : null
          const secondDepart = secondDepartStr(key)
          const secondMins = secondDepart ? timeStrToMinutes(secondDepart, now) : null
          const validSecondMins = secondMins != null && secondMins >= 0 ? secondMins : null
          const isLastTrain = depart != null && timetable != null && secondDepart == null
          const nextVal = depart ? { minutes: validMins, hhmm: depart } : null
          const afterNextVal = secondDepart ? { minutes: validSecondMins, hhmm: secondDepart } : null
          const favCode = `subway:${stationGroup}:${key}`
          if (favoritesOnly && !favCodes.includes(favCode)) return null
          const handleClick = () => setSubwayDetailSheet({
            station: stationGroup,
            lineName: dir.subtitle,
            timetableKey: key,
            direction: label,
            color: dir.color,
            darkColor: dir.darkColor,
            lightColor: dir.lightColor,
            symbol: dir.symbol,
          })
          return (
            <ScheduleSection
              key={`${stationGroup}:${key}`}
              title={`${stationGroup} ${label}`}
              subtitle={dir.subtitle}
              type="subway"
              routeCode={dir.subtitle}
              next={nextVal}
              afterNext={afterNextVal}
              minutesUntil={validMins}
              onClick={handleClick}
              loading={loading}
              lineColor={dir.color}
              lastBus={isLastTrain}
            />
          )
        }),
      ])}
    </>
  )
}

// ─── shuttle section ─────────────────────────────────────────────────────────
function ShuttleSection({ direction, onCardClick, favoritesOnly = false, favCodes = [] }) {
  const label = direction % 2 === 0 ? '등교' : '하교'
  const campusTag = direction >= 2 ? '2캠 ' : ''
  const titleText = `${campusTag}셔틀 ${label}`.trim()
  const favCode = `shuttle:${campusTag}${label}`.trim()
  const { data, loading, error } = useShuttleSchedule(direction)
  if (favoritesOnly && !favCodes.includes(favCode)) return null

  const subtitleText = direction >= 2 ? '2캠' : '본캠'
  const routeCode = `${campusTag}셔틀${label}`.trim()

  const noSchedule = !loading && (error || !data || (data.directions ?? []).length === 0)
  if (noSchedule) {
    return (
      <ScheduleSection
        title={titleText}
        subtitle={subtitleText}
        type="shuttle"
        routeCode={routeCode}
        next={null}
        afterNext={null}
        loading={false}
        disabled
        disabledLabel="주말·공휴일 미운행 — 시간표 추후 업데이트 예정"
      />
    )
  }

  const now = new Date()
  const dirData = data?.directions?.find((d) => d.direction === direction)

  const rawEntries = (dirData?.times ?? []).map((t) =>
    typeof t === 'string' ? { depart_at: t, note: null } : { depart_at: t?.depart_at ?? '', note: t?.note ?? null }
  )
  const futureEntries = rawEntries.filter((e) => {
    const ts = (e.depart_at ?? '').slice(0, 5)
    if (!ts) return false
    const [h, m] = ts.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d > now && (d - now) <= 12 * 60 * 60 * 1000
  })

  const hasPastFrequent = rawEntries.some((e) => {
    if (e.note !== '수시운행') return false
    const ts = (e.depart_at ?? '').slice(0, 5)
    if (!ts) return false
    const [h, m] = ts.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d <= now
  })
  const inFrequent = hasPastFrequent && futureEntries[0]?.note === '수시운행'

  const MAX_SHUTTLE_ROWS = 4
  const handleClick = () => onCardClick({ type: 'shuttle', routeCode, direction, favCode, title: `${campusTag}셔틀버스 ${label}` })

  function buildRow(e) {
    const ts = e.depart_at?.slice(0, 5) ?? null
    const computed = ts ? timeStrToMinutes(ts, now) : null
    const minsPositive = computed != null && computed >= 0 ? computed : null
    const isReturn = e.note?.startsWith?.('회차편') ?? false
    const isFrequentReturn = isReturn && (e.note?.includes('수시운행') ?? false)
    const isFrequent = e.note === '수시운행'

    if (isFrequentReturn) {
      return {
        key: `t-${ts}-frequent-return`,
        departStr: null,
        mins: null,
        statusLabel: ts ? `수시 회차편 (${ts} 이후)` : '수시 회차편 대기',
        isReturn: true,
      }
    }
    if (isReturn) {
      return {
        key: `t-${ts}-return`,
        departStr: null,
        mins: null,
        statusLabel: '회차편 탑승',
        isReturn: true,
      }
    }
    return {
      key: `t-${ts}-${e.note ?? ''}`,
      departStr: ts,
      mins: minsPositive,
      statusLabel: isFrequent ? '수시운행' : null,
      isReturn,
    }
  }

  const rows = []
  if (inFrequent) {
    const endEntry = futureEntries.find((e) => e.note !== '수시운행')
    const endAt = endEntry?.depart_at?.slice(0, 5)
    rows.push({
      key: 'frequent',
      departStr: null,
      mins: null,
      statusLabel: endAt ? `${endAt}까지 수시운행` : '수시운행 중',
    })
    const post = futureEntries.filter((e) => e.note !== '수시운행')
    for (const e of post.slice(0, MAX_SHUTTLE_ROWS - 1)) {
      rows.push(buildRow(e))
    }
  } else {
    for (const e of futureEntries.slice(0, MAX_SHUTTLE_ROWS)) {
      rows.push(buildRow(e))
    }
  }

  if (rows.length === 0) {
    return (
      <ScheduleSection
        title={titleText}
        subtitle={subtitleText}
        type="shuttle"
        routeCode={routeCode}
        next={null}
        afterNext={null}
        loading={false}
        endOfDay
        onClick={handleClick}
      />
    )
  }

  const first = rows[0]
  const second = rows[1]
  const extras = rows.slice(2)
    .map((r) => r.departStr)
    .filter((s) => typeof s === 'string' && s.length > 0)
  return (
    <ScheduleSection
      title={titleText}
      subtitle={subtitleText}
      type="shuttle"
      routeCode={routeCode}
      next={first?.statusLabel ?? (first?.departStr ? { minutes: first.mins, hhmm: first.departStr } : null)}
      afterNext={second?.statusLabel ?? (second?.departStr ? { minutes: second.mins, hhmm: second.departStr } : null)}
      minutesUntil={first?.mins ?? null}
      onClick={handleClick}
      loading={loading}
      extraTimes={extras.length > 0 ? extras : null}
    />
  )
}

// ─── bus group content (동적 API 로드) ─────────────────────────────────────
function BusGroupContent({ busGroup, onCardClick, favoritesOnly = false, favCodes = [] }) {
  const { data: routes, loading } = useBusRoutesByCategory(busGroup)
  const { data: markersData } = useMapMarkers()
  const markers = markersData?.markers ?? []

  if (loading && !routes) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-surface-dark rounded-xl animate-pulse" />
        ))}
      </>
    )
  }

  const routeList = Array.isArray(routes) ? routes : []

  const entries = routeList.map((route) => {
    const stop = route.stops?.[0] ?? null
    const stopName = stop?.name ?? null
    const favCode = stopName != null ? `${busGroup}:${route.route_number}` : route.route_number
    const stopLat = stop?.lat ?? null
    const stopLng = stop?.lng ?? null
    const markerCoord = findMarkerCoord(markers, route.route_number, stop?.stop_id ?? null, stopLat, stopLng)
    return {
      code: route.route_number,
      routeId: route.route_id ?? null,
      favCode,
      stopId: stop?.stop_id ?? null,
      destLabel: route.direction_name ?? null,
      originLabel: stopName?.replace('한국공학대학교', '본캠') ?? null,
      mapLat: markerCoord?.lat ?? stopLat,
      mapLng: markerCoord?.lng ?? stopLng,
      isRealtime: route.is_realtime ?? false,
    }
  })

  const sorted = [...entries].sort((a, b) =>
    (a.originLabel ?? '').localeCompare(b.originLabel ?? '', 'ko')
  )
  const displayEntries = favoritesOnly
    ? sorted.filter((e) => favCodes.includes(e.favCode))
    : sorted

  if (displayEntries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        {favoritesOnly ? '즐겨찾기한 노선이 없어요' : '해당 그룹의 버스가 없어요'}
      </p>
    )
  }

  return displayEntries.map((e) => (
    <BusRouteSection
      key={e.favCode}
      busGroup={busGroup}
      routeCode={e.code}
      routeId={e.routeId}
      stopId={e.stopId}
      favCode={e.favCode}
      destLabel={e.destLabel}
      originLabel={e.originLabel}
      mapLat={e.mapLat}
      mapLng={e.mapLng}
      isRealtime={e.isRealtime}
      onCardClick={onCardClick}
    />
  ))
}

// ─── main component ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [query, setQuery] = useState(readQuery)

  useEffect(() => {
    const sync = () => setQuery(readQuery())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const storedMode = useAppStore((s) => s.selectedMode)
  const setStoredMode = useAppStore((s) => s.setSelectedMode)
  const shuttleCampus = useAppStore((s) => s.selectedShuttleCampus)
  const setShuttleCampus = useAppStore((s) => s.setShuttleCampus)
  const scheduleHint = useAppStore((s) => s.scheduleHint)
  const setScheduleHint = useAppStore((s) => s.setScheduleHint)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const setMapPanTarget = useAppStore((s) => s.setMapPanTarget)

  const initialMode = isValidMode(query.type)
    ? query.type
    : (isValidMode(storedMode) ? storedMode : 'bus')

  const [mode, setMode] = useState(initialMode)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favCodes = favorites.routes ?? []
  const [busGroup, setBusGroup] = useState('하교')
  const [subwayGroup, setSubwayGroup] = useState('정왕')
  const [selectedDetail, setSelectedDetail] = useState(null)

  useEffect(() => {
    if (isValidMode(query.type) && query.type !== mode) {
      setMode(query.type)
    }
  }, [query.type]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scheduleHint) return
    if (isValidMode(scheduleHint.mode)) {
      setMode(scheduleHint.mode)
      setStoredMode(scheduleHint.mode)
    }
    if (scheduleHint.group) {
      if (scheduleHint.mode === 'bus') setBusGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'subway') setSubwayGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'shuttle') {
        if (scheduleHint.group === 'main' || scheduleHint.group === 'second') setShuttleCampus(scheduleHint.group)
      }
    }
    setScheduleHint(null)
  }, [scheduleHint, setScheduleHint, setStoredMode, setShuttleCampus])

  function handleModeChange(next) {
    if (next === mode) return
    setMode(next)
    setStoredMode(next)
    navigateSchedule({ type: next })
  }

  function isFav(code) {
    return favorites.routes?.includes(code) ?? false
  }
  const handleToggleFav = (code) => toggleFavoriteRoute(code)
  const handleCardClick = (detail) => setSelectedDetail(detail)
  const handleModalClose = () => setSelectedDetail(null)

  const groups =
    mode === 'bus' ? BUS_GROUP_IDS
    : mode === 'subway' ? SUBWAY_GROUPS
    : mode === 'shuttle' ? SHUTTLE_CAMPUS_GROUPS
    : []
  const activeGroupId =
    mode === 'bus' ? busGroup
    : mode === 'subway' ? subwayGroup
    : mode === 'shuttle' ? shuttleCampus
    : null
  const setActiveGroup =
    mode === 'bus' ? setBusGroup
    : mode === 'subway' ? setSubwayGroup
    : mode === 'shuttle' ? setShuttleCampus
    : () => {}

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark animate-fade-in-up" style={{ paddingTop: 'var(--banner-h, 0px)' }}>
      <PageHeader title="시간표" subtitle="노선·역·방향별 전체 시간표" />

      {/* top mode tabs + 즐겨찾기 필터 */}
      <div className="px-4 pb-2 flex items-center justify-between gap-2 flex-shrink-0">
        <SegmentTabs
          tabs={MODES}
          active={mode}
          onChange={handleModeChange}
        />
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          aria-pressed={favoritesOnly}
          className="pressable flex-shrink-0"
          style={{
            padding: '5px 11px',
            borderRadius: 999,
            border: favoritesOnly
              ? '1.5px solid var(--tj-pill-active-bg)'
              : '1.5px solid var(--tj-line)',
            background: favoritesOnly ? 'var(--tj-pill-active-bg)' : 'transparent',
            color: favoritesOnly ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition:
              'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
          }}
        >
          ★ 즐겨찾기
        </button>
      </div>

      {/* group secondary pills */}
      {groups.length > 0 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
            {groups.map((g) => {
              const isActive = activeGroupId === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  aria-pressed={isActive}
                  className="pressable whitespace-nowrap flex-shrink-0"
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    border: isActive
                      ? '1.5px solid var(--tj-pill-active-bg)'
                      : '1.5px solid var(--tj-line)',
                    background: isActive ? 'var(--tj-pill-active-bg)' : 'transparent',
                    color: isActive ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition:
                      'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
                  }}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
        <div key={mode} className="flex flex-col gap-2 animate-fade-in">
          {mode === 'bus' && (
            <BusGroupContent
              busGroup={busGroup}
              onCardClick={handleCardClick}
              favoritesOnly={favoritesOnly}
              favCodes={favCodes}
            />
          )}
          {mode === 'subway' && (
            <SubwaySection
              stationGroup={subwayGroup}
              onCardClick={handleCardClick}
              favoritesOnly={favoritesOnly}
              favCodes={favCodes}
            />
          )}
          {mode === 'shuttle' && (SHUTTLE_CAMPUS_DIRECTIONS[shuttleCampus] ?? SHUTTLE_CAMPUS_DIRECTIONS.main).map((g) => (
            <ShuttleSection
              key={`${shuttleCampus}:${g.id}`}
              direction={g.direction}
              onCardClick={handleCardClick}
              favoritesOnly={favoritesOnly}
              favCodes={favCodes}
            />
          ))}
        </div>
      </div>

      <ScheduleDetailModal
        open={selectedDetail != null}
        onClose={handleModalClose}
        type={selectedDetail?.type}
        routeCode={selectedDetail?.routeCode}
        routeId={selectedDetail?.routeId ?? null}
        stopId={selectedDetail?.stopId ?? null}
        direction={selectedDetail?.direction}
        subwayKey={selectedDetail?.subwayKey}
        accentColor={selectedDetail?.accentColor}
        isRealtime={selectedDetail?.isRealtime ?? false}
        title={selectedDetail?.title ?? ''}
        isFavorite={selectedDetail?.favCode ? isFav(selectedDetail.favCode) : false}
        onToggleFav={selectedDetail?.favCode ? () => handleToggleFav(selectedDetail.favCode) : null}
        onShowMap={
          selectedDetail?.mapLat != null && selectedDetail?.mapLng != null
            ? () => {
                setMapPanTarget({ lat: selectedDetail.mapLat, lng: selectedDetail.mapLng })
                handleModalClose()
                if (window.location.pathname !== '/') {
                  window.history.pushState({}, '', '/')
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }
              }
            : null
        }
      />
    </div>
  )
}
