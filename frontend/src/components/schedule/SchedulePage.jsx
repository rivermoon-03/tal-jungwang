/**
 * SchedulePage — 시간표 탭
 * - 상단 mode pill: 버스 · 지하철 · 셔틀 (바로 전환)
 * - 각 모드별 그룹 pill selector (지하철: 정왕/초지/시흥시청, 버스: 하교/등교/기타)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNow } from '../../hooks/useNow'
import ScheduleSection from './ScheduleSection'
import ScheduleDetailModal from './ScheduleDetailModal'
import PageHeader from '../layout/PageHeader'
import SegmentTabs from '../common/SegmentTabs'
import RouteBadge from '../common/RouteBadge'
import Skeleton from '../common/Skeleton'
import BusArrivalCard, { CrowdedBadge } from '../bus/BusArrivalCard'
import useAppStore from '../../stores/useAppStore'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { useBusTimetable, useBusTimetableByRoute, useBusArrivals, useBusRoutesByCategory } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext, useSubwayTimetable, useSubwayRealtime, normalizeRealtimeStation } from '../../hooks/useSubway'
import { RealtimeCompactCard } from '../subway/SubwayRealtimeCard'
import { useMapMarkers } from '../../hooks/useMapMarkers'
import { getFirstBusLabel } from '../../utils/arrivalTime'
import { getGbisStationIdForRoute, getRouteCategory, ROUTE_CATEGORY_ORDER } from '../dashboard/busStationConfig'
import { BarChart3, CalendarClock } from 'lucide-react'
import StatsSheet from './StatsSheet'
import SubwayDataModeToggle from '../subway/SubwayDataModeToggle'
import HolidayBanner from '../common/HolidayBanner'

// PC · 시간표 2열 레이아웃(좌: 노선 리스트 / 우: 상세)에서 아직 아무 노선도
// 선택하지 않았을 때 우측 컬럼에 보이는 빈 상태.
function ScheduleDetailEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
      <CalendarClock size={32} className="text-mute dark:text-mute" aria-hidden="true" />
      <p className="text-label font-semibold text-mute dark:text-mute">
        왼쪽에서 노선을 선택하면
        <br />
        상세 시간표가 여기 표시돼요
      </p>
    </div>
  )
}

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
  { id: '기타', label: '기타 노선' },
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
function BusRouteSection({ busGroup, routeCode, routeId, stopId, favCode, destLabel, originLabel, mapLat, mapLng, isRealtime, onCardClick, onHasDataChange }) {
  const now = new Date()

  const stationId = isRealtime ? getGbisStationIdForRoute(routeCode, busGroup) : null
  const { data: timetableByIdData } = useBusTimetable(routeId ?? null)
  const { data: timetableByRouteData } = useBusTimetableByRoute(
    routeId == null ? routeCode : null,
    stopId ? { stopId } : undefined,
  )
  const timetableData = routeId != null ? timetableByIdData : timetableByRouteData
  const { data: arrivalsData } = useBusArrivals(stationId)

  // 실시간/시간표 모두 hasData 정렬을 위해 분기 이전에 한 번 계산.
  const arrivalsList = Array.isArray(arrivalsData) ? arrivalsData : arrivalsData?.arrivals ?? []
  const realtimeMatches = isRealtime
    ? arrivalsList
        .filter((a) => a.route_no === routeCode && a.arrival_type === 'realtime')
        .sort((a, b) => (a.arrive_in_seconds ?? 0) - (b.arrive_in_seconds ?? 0))
    : []

  const allTimes = !isRealtime ? (timetableData?.times ?? []) : []
  const future = !isRealtime
    ? allTimes
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
    : []

  const hasData = isRealtime ? realtimeMatches.length > 0 : future.length > 0
  useEffect(() => {
    onHasDataChange?.(favCode, hasData)
  }, [favCode, hasData, onHasDataChange])

  // onClick adapter: BusArrivalCard의 onTimetableClick(route_id, route_no, label) →
  // 기존 onCardClick({ type:'bus', ... }) 형태로 변환
  const handleCardClick = (rid, rno, _lbl) => {
    onCardClick({
      type: 'bus',
      routeCode: rno ?? routeCode,
      routeId: rid ?? routeId,
      stopId,
      category: busGroup,
      favCode: favCode ?? rno ?? routeCode,
      mapLat,
      mapLng,
      isRealtime,
      title: destLabel ? `${rno ?? routeCode} · ${destLabel}` : `${rno ?? routeCode}번 버스`,
      accentColor: (['3400', '5200', '6502', '3401'].includes(rno ?? routeCode)) ? '#DC2626' : undefined,
    })
  }

  if (isRealtime) {
    // arrivals 어댑터: matches가 있으면 그대로, 없으면 muted placeholder 1개
    const arrivals = realtimeMatches.length > 0
      ? realtimeMatches
      : [{
          route_no: routeCode,
          route_id: routeId,
          destination: destLabel,
          category: busGroup,
          arrival_type: 'realtime',
          // arrive_in_seconds 없음 → computeDisplay에서 etaValue='—'
        }]

    return (
      <BusArrivalCard
        arrivals={arrivals}
        stationId={stopId}
        onTimetableClick={handleCardClick}
      />
    )
  }

  const toStr = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null

  // arrivals 어댑터: future 배열에서 최대 2개 항목, 없으면 muted placeholder
  const arrivals = future.length > 0
    ? future.slice(0, 2).map((d) => ({
        route_no: routeCode,
        route_id: routeId,
        destination: destLabel,
        category: busGroup,
        arrival_type: 'timetable',
        depart_at: toStr(d),
        is_tomorrow: d.getDate() !== now.getDate(),
      }))
    : [{
        route_no: routeCode,
        route_id: routeId,
        destination: destLabel,
        category: busGroup,
        arrival_type: 'timetable',
        // depart_at 없음 → computeDisplay에서 etaValue='—'
      }]

  return (
    <BusArrivalCard
      arrivals={arrivals}
      stationId={stopId}
      onTimetableClick={handleCardClick}
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
function SubwaySection({ stationGroup, onCardClick, favoritesOnly = false, favCodes = [], dataMode = 'timetable', setDataMode }) {
  const { data, loading } = useSubwayNext()
  const { data: timetable } = useSubwayTimetable()
  const { data: realtimeAll, loading: realtimeLoading } = useSubwayRealtime()
  // 백엔드 envelope({items, stale, last_successful_realtime_at})를 정규화.
  const { items: realtimeArrivals } = normalizeRealtimeStation(realtimeAll?.[stationGroup])
  const setSubwayLineSheet = useAppStore((s) => s.setSubwayLineSheet)
  const setSubwayDetailSheet = useAppStore((s) => s.setSubwayDetailSheet)
  const didAutoSwitchRef = useRef(false)
  const directions = SUBWAY_DIRECTIONS[stationGroup] ?? []
  // 1초 tick(분 단위 카운트다운 갱신용). 시간표 파생 계산은 분 단위로만 재계산한다.
  const nowMs = useNow(1000)
  const now = new Date(nowMs)
  // 분 단위로 절삭한 현재 시각(Asia/Seoul = 배포 로컬). 초가 바뀌어도 동일하므로
  // 아래 timetable 파생 useMemo가 매초 재계산되지 않게 하는 의존성 키로 쓴다.
  const nowMinute = Math.floor(nowMs / 60000)

  useEffect(() => { didAutoSwitchRef.current = false }, [stationGroup])

  useEffect(() => {
    if (!realtimeLoading) {
      if (realtimeArrivals.length === 0 && !didAutoSwitchRef.current) {
        didAutoSwitchRef.current = true
        setDataMode?.('timetable')
      } else if (realtimeArrivals.length > 0) {
        didAutoSwitchRef.current = false
      }
    }
  }, [realtimeArrivals, realtimeLoading, setDataMode])

  // 각 방향 key별 "둘째 출발 시각"(다음다음 열차). timetable과 분 단위 현재시각이
  // 바뀔 때만 재계산. 초 단위 tick으로는 .map().filter().sort()를 돌리지 않는다.
  const secondDepartMap = useMemo(() => {
    const out = {}
    // nowMinute를 분 경계의 Date로 재구성(초/밀리초 = 0). 사전순 비교 금지 — Date로 비교.
    const minuteNow = new Date(nowMinute * 60000)
    const keys = new Set()
    for (const dir of directions) {
      keys.add(dir.upKey)
      keys.add(dir.downKey)
    }
    for (const key of keys) {
      const list = timetable?.[key]
      if (!Array.isArray(list) || list.length === 0) {
        out[key] = null
        continue
      }
      const future = list
        .map((e) => {
          const ts = (e?.depart_at ?? '').slice(0, 5)
          if (!ts) return null
          const [h, m] = ts.split(':').map(Number)
          if (Number.isNaN(h) || Number.isNaN(m)) return null
          const d = new Date(minuteNow)
          d.setHours(h, m, 0, 0)
          if (d <= minuteNow) return null
          return { ts, d }
        })
        .filter(Boolean)
        .sort((a, b) => a.d - b.d)
      out[key] = future[1]?.ts ?? null
    }
    return out
  }, [timetable, nowMinute, directions])

  const handleTrainClick = useCallback(
    (item) => setSubwayLineSheet({ ...item, viewStation: stationGroup }),
    [setSubwayLineSheet, stationGroup],
  )

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

  return (
    <>
      {/* 실시간 모드 */}
      {dataMode === 'realtime' && (
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
                onTrainClick={handleTrainClick}
              />
            )
          })
        )
      )}

      {/* 시간표 모드 */}
      {dataMode === 'timetable' && directions.flatMap((dir) => [
        ...[
          { key: dir.upKey, label: dir.upLabel },
          { key: dir.downKey, label: dir.downLabel },
        ].map(({ key, label }) => {
          const entry = data?.[key]
          const depart = entry?.depart_at ?? null
          const mins = depart ? timeStrToMinutes(depart, now) : null
          const validMins = mins != null && mins >= 0 ? mins : null
          const secondDepart = secondDepartMap[key] ?? null
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
// 셔틀이 미운행일이면 다음 평일(월~금) 시간표를 폴백으로 보여줌.
// 본캠: 토·일 모두 미운행. 2캠(direction>=2): 일요일만 미운행(토요일은 운행).
function isShuttleOffDay(direction, d = new Date()) {
  const day = d.getDay()
  if (direction >= 2) return day === 0
  return day === 0 || day === 6
}

function nextWeekdayDateStr() {
  const d = new Date()
  const day = d.getDay()
  // 일요일(0) → +1, 토요일(6) → +2
  const offset = day === 0 ? 1 : day === 6 ? 2 : 0
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ShuttleSection({ direction, onCardClick, favoritesOnly = false, favCodes = [] }) {
  const label = direction % 2 === 0 ? '등교' : '하교'
  const campusTag = direction >= 2 ? '2캠 ' : ''
  const titleText = `${campusTag}셔틀 ${label}`.trim()
  const favCode = `shuttle:${campusTag}${label}`.trim()
  const today = useShuttleSchedule(direction)
  // 미운행일에만 다음 평일 폴백 fetch (enabled로 운행일에는 호출 안 함).
  // 본캠은 토·일 모두 미운행, 2캠은 일요일만 미운행이라 판정이 다르다.
  const offDay = isShuttleOffDay(direction)
  const fallbackDate = offDay ? nextWeekdayDateStr() : null
  const fallback = useShuttleSchedule(direction, fallbackDate, { enabled: offDay })

  // 요청한 direction에 시간 데이터가 있는지로 판정.
  // (백엔드는 direction param을 받아도 다른 방향이 응답 directions에 포함될 수 있어서
  //  단순 length 체크는 본캠 0번이 비었는데 2캠 2번 데이터로 폴백이 안 켜지는 케이스를 놓침.)
  const findDirTimes = (apiData) => apiData?.directions?.find((d) => d.direction === direction)?.times ?? []
  const todayEmpty = !today.loading && (today.error || findDirTimes(today.data).length === 0)
  const fallbackHasData = findDirTimes(fallback.data).length > 0
  const usingFallback = offDay && todayEmpty && fallbackHasData

  const data = usingFallback ? fallback.data : today.data
  // 폴백 fetch가 끝날 때까지 loading 유지 (깜빡임 방지)
  const loading = today.loading || (offDay && fallback.loading)
  const error = today.error && (!offDay || fallback.error)

  if (favoritesOnly && !favCodes.includes(favCode)) return null

  const subtitleText = direction >= 2 ? '2캠' : '본캠'
  const subtitleWithNotice = usingFallback ? `${subtitleText} · 평일 기준 시간표` : subtitleText
  const routeCode = `${campusTag}셔틀${label}`.trim()

  const noSchedule = !loading && (error || !data || (data.directions ?? []).length === 0)
  if (noSchedule) {
    const offLabel = direction >= 2
      ? '일·공휴일 미운행 — 시간표 추후 업데이트 예정'
      : '주말·공휴일 미운행 — 시간표 추후 업데이트 예정'
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
        disabledLabel={offLabel}
      />
    )
  }

  // 폴백 모드: 평일 시간표를 통째로 보여주되 카운트다운/minutesUntil은 의미 없으므로 미사용.
  if (usingFallback) {
    const dirData = data?.directions?.find((d) => d.direction === direction)
    const allTimes = (dirData?.times ?? [])
      .map((t) => (typeof t === 'string' ? t : t?.depart_at))
      .filter((s) => typeof s === 'string' && s.length > 0)
      .map((s) => s.slice(0, 5))
    const first = allTimes[0] ?? null
    const second = allTimes[1] ?? null
    const extras = allTimes.slice(2, 6)
    const handleClick = () => onCardClick({ type: 'shuttle', routeCode, direction, favCode, title: `${campusTag}셔틀버스 ${label}` })

    return (
      <ScheduleSection
        title={titleText}
        subtitle={subtitleWithNotice}
        type="shuttle"
        routeCode={routeCode}
        next={first ? `평일 첫차 ${first}` : null}
        afterNext={second ?? null}
        minutesUntil={null}
        onClick={handleClick}
        loading={false}
        extraTimes={extras.length > 0 ? extras : null}
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

  // BusRouteSection이 각자 도착/시간표 데이터 유무를 보고하는 맵.
  // 초기엔 비어 있다가 자식들이 useEffect로 채우며, 정렬이 재계산된다.
  const [hasDataMap, setHasDataMap] = useState({})
  const reportHasData = useCallback((favCode, has) => {
    setHasDataMap((prev) => (prev[favCode] === has ? prev : { ...prev, [favCode]: has }))
  }, [])

  // 그룹 전환 시 stale 데이터 플래그를 비워서 새 그룹이 자체 보고로 채우게 한다.
  useEffect(() => {
    setHasDataMap({})
  }, [busGroup])

  if (loading && !routes) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface-2 dark:bg-surface rounded-xl animate-pulse" />
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

  // 정렬 규칙: ① 데이터 보유 카드를 위로 ② 같은 그룹 내에서는 색상(카테고리: 광역→간선→시내) 순
  // ③ 동일 카테고리는 출발 정류장(originLabel)으로 안정 정렬.
  const sorted = [...entries].sort((a, b) => {
    const ad = hasDataMap[a.favCode] ?? false
    const bd = hasDataMap[b.favCode] ?? false
    if (ad !== bd) return ad ? -1 : 1
    const orderA = ROUTE_CATEGORY_ORDER.indexOf(getRouteCategory(a.code))
    const orderB = ROUTE_CATEGORY_ORDER.indexOf(getRouteCategory(b.code))
    if (orderA !== orderB) return orderA - orderB
    return (a.originLabel ?? '').localeCompare(b.originLabel ?? '', 'ko')
  })
  const displayEntries = favoritesOnly
    ? sorted.filter((e) => favCodes.includes(e.favCode))
    : sorted

  if (displayEntries.length === 0) {
    return (
      <p className="py-8 text-center text-body text-mute">
        {favoritesOnly ? '즐겨찾기한 노선이 없어요' : '해당 그룹의 버스가 없어요'}
      </p>
    )
  }

  // 3400 등교(강남 출발) 주말 시간표는 공식 자료(2022.3.10~) 기반이라 실제 운행과 차이가 날 수 있음.
  const todayDow = new Date().getDay()
  const showWeekend3400Notice =
    busGroup === '등교' &&
    (todayDow === 0 || todayDow === 6) &&
    displayEntries.some((e) => e.code === '3400')

  return (
    <>
      {showWeekend3400Notice && (
        <div
          role="status"
          className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-2.5 flex items-start gap-2"
        >
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">3400번 주말·휴일 강남 출발 시간표는 실제와 다를 수 있어요.</span>
            {' '}정확한 도착은 카카오버스 같은 실시간 앱을 함께 참고하세요.
          </p>
        </div>
      )}
      {displayEntries.map((e) => (
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
          onHasDataChange={reportHasData}
        />
      ))}
    </>
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const isDesktop = useIsDesktop()
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
  const [statsOpen, setStatsOpen] = useState(false)
  const [subwayDataMode, setSubwayDataMode] = useState('timetable')
  const favCodes = favorites.routes ?? []
  const [busGroup, setBusGroup] = useState('하교')
  const [subwayGroup, setSubwayGroup] = useState('정왕')
  useEffect(() => { setSubwayDataMode('timetable') }, [subwayGroup])
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

  const detailModalProps = {
    open: selectedDetail != null,
    onClose: handleModalClose,
    type: selectedDetail?.type,
    routeCode: selectedDetail?.routeCode,
    routeId: selectedDetail?.routeId ?? null,
    stopId: selectedDetail?.stopId ?? null,
    category: selectedDetail?.category ?? null,
    direction: selectedDetail?.direction,
    subwayKey: selectedDetail?.subwayKey,
    accentColor: selectedDetail?.accentColor,
    isRealtime: selectedDetail?.isRealtime ?? false,
    title: selectedDetail?.title ?? '',
    isFavorite: selectedDetail?.favCode ? isFav(selectedDetail.favCode) : false,
    onToggleFav: selectedDetail?.favCode ? () => handleToggleFav(selectedDetail.favCode) : null,
    onShowMap:
      selectedDetail?.mapLat != null && selectedDetail?.mapLng != null
        ? () => {
            setMapPanTarget({ lat: selectedDetail.mapLat, lng: selectedDetail.mapLng })
            handleModalClose()
            if (window.location.pathname !== '/') {
              window.history.pushState({}, '', '/')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }
          }
        : null,
  }

  const sectionViewProps = {
    mode,
    handleModeChange,
    favoritesOnly,
    setFavoritesOnly,
    groups,
    activeGroupId,
    setActiveGroup,
    busGroup,
    subwayGroup,
    shuttleCampus,
    handleCardClick,
    favCodes,
    onOpenStats: () => setStatsOpen(true),
    subwayDataMode,
    setSubwayDataMode,
  }

  return (
    <div className="flex flex-col h-full bg-surface dark:bg-bg animate-fade-in-up" style={{ paddingTop: 'var(--banner-h, 0px)' }}>
      <PageHeader title="시간표" />

      {isDesktop ? (
        // PC · 시간표 시안: 좌(노선 리스트+요일) / 우(선택한 노선의 그리드+통계).
        // 데이터 훅은 그대로 재사용 — 모바일의 리스트/모달 컴포넌트를 레이아웃만 갈아끼운다.
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="w-[380px] flex-shrink-0 h-full flex flex-col overflow-hidden border-r border-line dark:border-line">
            <ScheduleSectionView {...sectionViewProps} />
          </div>
          <div className="flex-1 min-w-0 h-full overflow-hidden bg-bg dark:bg-bg">
            {selectedDetail != null
              ? <ScheduleDetailModal {...detailModalProps} pcMode="inline" />
              : <ScheduleDetailEmptyState />}
          </div>
        </div>
      ) : (
        <ScheduleSectionView {...sectionViewProps} />
      )}

      <StatsSheet open={statsOpen} onClose={() => setStatsOpen(false)} />

      {/* 데스크톱은 위 우측 컬럼에 pcMode="inline"으로 이미 렌더 — 모바일 바텀시트만 추가로 마운트 */}
      {!isDesktop && <ScheduleDetailModal {...detailModalProps} />}
    </div>
  )
}

// ─── schedule section view ──────────────────────────────────────────────────
function ScheduleSectionView({
  mode,
  handleModeChange,
  favoritesOnly,
  setFavoritesOnly,
  groups,
  activeGroupId,
  setActiveGroup,
  busGroup,
  subwayGroup,
  shuttleCampus,
  handleCardClick,
  favCodes,
  onOpenStats,
  subwayDataMode,
  setSubwayDataMode,
}) {
  return (
    <>
      {/* top mode tabs + 통계 / 즐겨찾기 필터 */}
      <div className="px-4 pb-2 flex items-center justify-between gap-2 flex-shrink-0">
        <SegmentTabs
          tabs={MODES}
          active={mode}
          onChange={handleModeChange}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenStats}
            aria-label="오늘의 교통 통계 보기"
            className="pressable"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: '1.5px solid var(--tj-line)',
              background: 'transparent',
              color: 'var(--tj-mute)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition:
                'background var(--dur-motion-base) var(--e-out), color var(--dur-motion-base) var(--e-out), border-color var(--dur-motion-base) var(--e-out)',
            }}
          >
            <BarChart3 size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            className="pressable"
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
                'background var(--dur-motion-base) var(--e-out), color var(--dur-motion-base) var(--e-out), border-color var(--dur-motion-base) var(--e-out)',
            }}
          >
            ★ 즐겨찾기
          </button>
        </div>
      </div>

      {/* group secondary pills (+ subway 데이터 모드 토글) */}
      {groups.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
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
                      'background var(--dur-motion-base) var(--e-out), color var(--dur-motion-base) var(--e-out), border-color var(--dur-motion-base) var(--e-out)',
                  }}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
          {mode === 'subway' && (
            <div className="shrink-0">
              <SubwayDataModeToggle value={subwayDataMode} onChange={setSubwayDataMode} />
            </div>
          )}
        </div>
      )}

      {/* content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
        {(mode === 'subway' || mode === 'shuttle') && (
          <HolidayMetaBanner mode={mode} shuttleCampus={shuttleCampus} />
        )}
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
              dataMode={subwayDataMode}
              setDataMode={setSubwayDataMode}
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
    </>
  )
}

// ─── holiday meta banner ─────────────────────────────────────────────────────
// SubwaySection / ShuttleSection 이 내부적으로 동일 hook을 또 호출하므로
// useApi 의 shared cache 덕분에 추가 네트워크 비용은 발생하지 않는다.
function HolidayMetaBanner({ mode, shuttleCampus }) {
  // 지하철: timetable 응답에 is_holiday/holiday_name
  // 셔틀: schedule 응답에 is_holiday/holiday_name (캠퍼스/방향 무관 — 어느 direction 호출해도 같음)
  const { data: subwayTimetable } = useSubwayTimetable()
  const shuttleDir = shuttleCampus === 'second' ? 2 : 0
  const { data: shuttleSchedule } = useShuttleSchedule(shuttleDir)

  if (mode === 'subway') {
    return (
      <HolidayBanner
        isHoliday={Boolean(subwayTimetable?.is_holiday)}
        holidayName={subwayTimetable?.holiday_name ?? null}
      />
    )
  }
  if (mode === 'shuttle') {
    return (
      <HolidayBanner
        isHoliday={Boolean(shuttleSchedule?.is_holiday)}
        holidayName={shuttleSchedule?.holiday_name ?? null}
      />
    )
  }
  return null
}
