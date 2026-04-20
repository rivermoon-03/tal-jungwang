/**
 * SchedulePage — 시간표 탭
 * - 상단 mode pill: 버스 · 지하철 · 셔틀 (바로 전환)
 * - 각 모드별 그룹 pill selector (지하철: 정왕/초지/시흥시청, 버스: 하교/등교/기타)
 * - 리스트 / 타임라인 뷰 토글 (Favorites 페이지와 동일한 UX)
 */
import { useState, useEffect } from 'react'
import ScheduleSection from './ScheduleSection'
import ScheduleDetailModal from './ScheduleDetailModal'
import PageHeader from '../layout/PageHeader'
import SegmentTabs from '../common/SegmentTabs'
import RouteBadge from '../common/RouteBadge'
import Skeleton from '../common/Skeleton'
import useAppStore from '../../stores/useAppStore'
import { useBusTimetable, useBusTimetableByRoute, useBusArrivals, useBusRoutesByCategory } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext, useSubwayTimetable } from '../../hooks/useSubway'
import { useMapMarkers } from '../../hooks/useMapMarkers'
import { getFirstBusLabel } from '../../utils/arrivalTime'
import { getGbisStationIdForRoute } from '../dashboard/busStationConfig'

// ─── map marker lookup ──────────────────────────────────────────────────────
// 위치 버튼은 GBIS 정류장 좌표가 아닌 실제 지도에 그려진 마커 좌표로 이동해야 한다.
// (예: 3400 시화 정류장은 실제로 안산에 있지만 마커는 정왕 hub 위치에 있다.)
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
  // 1) bus_seoul: (route_number, stop_id) 정확 매칭이 최우선 (좌표 차이 큼)
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
  // 2) 좌표 근접 매칭 (1km 이내) — 같은 hub를 공유하지만 routes에 등록되지 않은 노선용
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

const SHUTTLE_GROUPS = [
  { id: '등교', label: '등교', direction: 0 },
  { id: '하교', label: '하교', direction: 1 },
]

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
  // 자정 이후 전날 막차 오인 방지: 음수이거나 12시간 이상이면 null
  if (diff < 0 || diff > 12 * 60) return null
  return diff
}

// destLabel에 '행' 접미사를 자연스럽게 붙인다
// ('안산'→'안산행', '안산행'→'안산행', '시흥시청방면'→'시흥시청행', '강남역방면(시화출발)'→'강남역행(시화출발)')
function withHaeng(label) {
  if (!label) return label
  if (/방면/.test(label)) return label.replace(/\s*방면/g, '행')
  return label.endsWith('행') ? label : `${label}행`
}

// ─── timeline row (FavoritesTimeline과 동일한 비주얼) ────────────────────────
function TimelineRow({
  routeCode,
  direction = null,
  minutes = null,
  lastTrain = false,
  statusLabel = null,
  onClick,
  loading = false,
  disabled = false,
  disabledLabel = null,
  order = 0,
}) {
  const hasMin = minutes != null && Number.isFinite(minutes)
  const urgent = hasMin && minutes <= 3
  const soon = hasMin && minutes <= 0
  const clickable = !!onClick && !disabled

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      className="pressable"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        paddingLeft: 36,
        paddingBottom: 16,
        border: 'none',
        background: 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
        order,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 8,
          top: 6,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: urgent ? 'var(--tj-accent)' : 'var(--tj-bg-soft)',
          border: `2.5px solid ${urgent ? 'var(--tj-accent)' : 'var(--tj-line)'}`,
          boxShadow: '0 0 0 3px var(--tj-bg-soft)',
        }}
      />
      {/* 왼쪽: 노선·방향·상태 라벨 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RouteBadge route={routeCode} variant="chip" size="sm" />
          {direction && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--tj-ink)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              className="dark:text-slate-100"
            >
              {direction}
            </span>
          )}
          {lastTrain && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--line-express)',
                color: '#fff',
                letterSpacing: '0.08em',
              }}
            >
              막차
            </span>
          )}
        </div>
        {(disabled || statusLabel) && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--tj-mute)', fontWeight: 600 }}>
            {disabled ? (disabledLabel ?? '정보 없음') : statusLabel}
          </div>
        )}
      </div>

      {/* 오른쪽: display 크기 분 표시 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          marginLeft: 8,
          minWidth: 60,
          fontVariantNumeric: 'tabular-nums',
          color: urgent ? 'var(--tj-accent)' : 'var(--tj-ink)',
        }}
        className={urgent ? 'tj-urgent dark:text-slate-100' : 'dark:text-slate-100'}
      >
        {disabled ? null : loading ? (
          <Skeleton width="3.2rem" height="1.8rem" rounded="rounded-md" />
        ) : soon ? (
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            곧 도착
          </span>
        ) : hasMin ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {minutes}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em' }}>분</span>
          </div>
        ) : !statusLabel ? (
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--tj-mute)', lineHeight: 1 }}>—</span>
        ) : null}
      </div>
    </button>
  )
}

// ─── per-route bus section ───────────────────────────────────────────────────
function BusRouteSection({ busGroup, routeCode, routeId, stopId, favCode, destLabel, originLabel, mapLat, mapLng, isRealtime, onCardClick, view = 'list' }) {
  const now = new Date()
  // 하교: 목적지에 '행' 접미사 자동 추가 ('정왕역 출발 · 안산행')
  const dest = busGroup === '하교' ? withHaeng(destLabel) : destLabel
  const titleText = originLabel
    ? (dest ? `${originLabel} 출발 · ${dest}` : `${originLabel} 출발`)
    : (dest ?? routeCode)

  // 실시간 노선마다 정차 정류장이 다름 (예: 시흥33/20-1 → 한국공학대, 시흥1 → 이마트)
  const stationId = isRealtime ? getGbisStationIdForRoute(routeCode) : null
  // route_id가 있으면 /bus/timetable/{route_id}(방향 정확)를 우선 사용
  // route_id 없으면 route_number 기반 fallback
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
      nextLabel = getFirstBusLabel(timetableData?.times ?? [], now)
    } else if (firstMin <= 0) nextLabel = '곧 도착'
    else nextLabel = `${firstMin}분 뒤`

    const favKey = favCode ?? routeCode
    // 리스트: 출발지 이름순 (DOM 순서) → order=0. 타임라인: 분 단위 정렬.
    const orderVal = view === 'timeline' ? (firstMin ?? 1_000_000) : 0
    if (view === 'timeline') {
      return (
        <TimelineRow
          routeCode={routeCode}
          direction={titleText}
          minutes={firstMin}
          loading={arrivalsLoading && matches.length === 0}
          order={orderVal}
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
            accentColor: (['3400', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
          })}
        />
      )
    }
    return (
      <ScheduleSection
        title={titleText}
        subtitle={first?.destination ? `실시간 · ${withHaeng(first.destination)}` : '실시간'}
        type="bus"
        routeCode={routeCode}
        destLabel={null}
        next={nextLabel}
        afterNext={secondMin != null ? (secondMin <= 0 ? '곧 도착' : `${secondMin}분 뒤`) : null}
        minutesUntil={firstMin}
        loading={arrivalsLoading && matches.length === 0}
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
          accentColor: (['3400', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
        })}
        order={orderVal}
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
    .filter((d) => {
      // 12시간 이내의 다가오는 버스만 '다음 버스'로 인정 (너무 먼 미래 배제)
      return (d - now) < 12 * 60 * 60 * 1000
    })
    .sort((a, b) => a - b)

  const toStr = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null

  const nextMin = !future[0] ? null : Math.round((future[0] - now) / 60000)
  const _hour = now.getHours()
  const isLateNightGap = (_hour >= 23 || _hour < 5) && (nextMin === null || nextMin >= 100)

  const nextStr = isLateNightGap ? getFirstBusLabel(allTimes, now) : (toStr(future[0]) ?? getFirstBusLabel(allTimes, now))
  const mins = isLateNightGap ? null : nextMin

  const favKey = favCode ?? routeCode
  // 리스트: 출발지 이름순 (DOM 순서) → order=0. 타임라인: 분 단위 정렬.
  const orderVal = view === 'timeline' ? (mins ?? 1_000_000) : 0
  const handleClick = () => onCardClick({
    type: 'bus',
    routeCode,
    routeId,
    stopId,
    favCode: favKey,
    mapLat,
    mapLng,
    title: destLabel ? `${routeCode} · ${destLabel}` : `${routeCode}번 버스`,
    accentColor: (['3400', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
  })
  if (view === 'timeline') {
    return (
      <TimelineRow
        routeCode={routeCode}
        direction={titleText}
        minutes={mins}
        loading={timetableLoading}
        order={orderVal}
        onClick={handleClick}
      />
    )
  }
  return (
    <ScheduleSection
      title={titleText}
      subtitle={destLabel ? null : '버스'}
      type="bus"
      routeCode={routeCode}
      destLabel={null}
      next={nextStr}
      afterNext={toStr(future[1])}
      minutesUntil={mins}
      onClick={handleClick}
      loading={timetableLoading}
      order={orderVal}
    />
  )
}

// ─── subway direction config per station ─────────────────────────────────────
const SUBWAY_DIRECTIONS = {
  정왕: [
    { subtitle: '수인분당선', upKey: 'up',       downKey: 'down',       upLabel: '상행',   downLabel: '하행',   color: '#F5A623' },
    { subtitle: '4호선',     upKey: 'line4_up', downKey: 'line4_down', upLabel: '상행',   downLabel: '하행',   color: '#1B5FAD' },
  ],
  초지: [
    { subtitle: '서해선',    upKey: 'choji_up', downKey: 'choji_dn',   upLabel: '상행',   downLabel: '하행',   color: '#75bf43' },
  ],
  시흥시청: [
    { subtitle: '서해선',    upKey: 'siheung_up', downKey: 'siheung_dn', upLabel: '상행', downLabel: '하행',   color: '#75bf43' },
  ],
}

// ─── subway section ──────────────────────────────────────────────────────────
function SubwaySection({ stationGroup, onCardClick, view = 'list' }) {
  const { data, loading } = useSubwayNext()
  // 리스트에서 '그 다음' 시각 계산용 시간표 (캐시 12h)
  const { data: timetable } = useSubwayTimetable()
  const directions = SUBWAY_DIRECTIONS[stationGroup] ?? []
  const now = new Date()

  // '그 다음' 시간: 시간표에서 현재 시각 이후 두 번째 출발편의 HH:MM
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
    if (view === 'timeline') {
      return (
        <TimelineRow
          routeCode={stationGroup}
          direction="지하철"
          disabled
          disabledLabel="정보 준비 중"
        />
      )
    }
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
      {directions.flatMap((dir) => [
        ...[
          { key: dir.upKey, label: dir.upLabel },
          { key: dir.downKey, label: dir.downLabel },
        ].map(({ key, label }) => {
          const entry = data?.[key]
          const depart = entry?.depart_at ?? null
          const mins = depart ? timeStrToMinutes(depart, now) : null
          const validMins = mins != null && mins >= 0 ? mins : null
          // 리스트: 자연 순서 (수인분당선 → 4호선, 상행 → 하행). 타임라인: 분 단위 정렬.
          const orderVal = view === 'timeline' ? (validMins ?? 1_000_000) : 0
          const favCode = `subway:${stationGroup}:${key}`
          const handleClick = () => onCardClick({ type: 'subway', routeCode: stationGroup, subwayKey: key, favCode, accentColor: dir.color, title: `${stationGroup}역 ${dir.subtitle} ${label}` })
          if (view === 'timeline') {
            return (
              <TimelineRow
                key={`${stationGroup}:${key}`}
                routeCode={dir.subtitle}
                direction={`${stationGroup} ${label}`}
                minutes={validMins}
                lastTrain={Boolean(entry?.last_train)}
                loading={loading}
                order={orderVal}
                onClick={handleClick}
              />
            )
          }
          return (
            <ScheduleSection
              key={`${stationGroup}:${key}`}
              title={`${stationGroup} ${label}`}
              subtitle={dir.subtitle}
              type="subway"
              routeCode={dir.subtitle}
              next={depart}
              afterNext={secondDepartStr(key)}
              minutesUntil={validMins}
              onClick={handleClick}
              loading={loading}
              lineColor={dir.color}
              order={orderVal}
            />
          )
        }),
      ])}
    </>
  )
}

// ─── shuttle section ─────────────────────────────────────────────────────────
function ShuttleSection({ direction, onCardClick, view = 'list' }) {
  const label = direction === 0 ? '등교' : '하교'
  const { data, loading, error } = useShuttleSchedule(direction)

  const noSchedule = !loading && (error || !data || (data.directions ?? []).length === 0)
  if (noSchedule) {
    if (view === 'timeline') {
      return (
        <TimelineRow
          routeCode={`${label}셔틀`}
          direction="한국공대"
          disabled
          disabledLabel="주말·공휴일 미운행"
        />
      )
    }
    return (
      <ScheduleSection
        title={`셔틀 ${label}`}
        subtitle="한국공대"
        type="shuttle"
        routeCode={`셔틀${label}`}
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

  // note 판별: 수시운행 / 회차편은 정확한 시간 대신 상태 라벨로 표시
  const rawEntries = (dirData?.times ?? []).map((t) =>
    typeof t === 'string' ? { depart_at: t, note: null } : { depart_at: t?.depart_at ?? '', note: t?.note ?? null }
  )
  // Date 기반 비교로 자정 이후 오인 방지 (문자열 비교 제거)
  const futureEntries = rawEntries.filter((e) => {
    const ts = (e.depart_at ?? '').slice(0, 5)
    if (!ts) return false
    const [h, m] = ts.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d > now && (d - now) <= 12 * 60 * 60 * 1000
  })

  // 수시운행 구간 판단 (Date 기반으로 이미 지난 수시운행 항목 체크)
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
  // 수시운행 구간 안이면 그 구간을 단일 "수시운행 중" 행으로 치환
  const inFrequent = hasPastFrequent && futureEntries[0]?.note === '수시운행'

  // 최대 4건 — "다음, 다다음, 다다다음, 다다다다음"
  const MAX_SHUTTLE_ROWS = 4
  const handleClick = () => onCardClick({ type: 'shuttle', routeCode: `셔틀${label}`, direction, favCode: `shuttle:${label}`, title: `셔틀버스 ${label}` })

  // 행 descriptor 빌드: { key, departStr, mins, statusLabel, isReturn }
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
    // 수시운행 종료 이후 편들
    const post = futureEntries.filter((e) => e.note !== '수시운행')
    for (const e of post.slice(0, MAX_SHUTTLE_ROWS - 1)) {
      const ts = e.depart_at?.slice(0, 5) ?? null
      const mins = ts ? timeStrToMinutes(ts, now) : null
      const isReturn = e.note?.startsWith?.('회차편') ?? false
      rows.push({
        key: `t-${ts}-${e.note ?? ''}`,
        departStr: ts,
        mins: mins != null && mins >= 0 ? mins : null,
        statusLabel: isReturn ? '회차편 탑승' : null,
        isReturn,
      })
    }
  } else {
    for (const e of futureEntries.slice(0, MAX_SHUTTLE_ROWS)) {
      const ts = e.depart_at?.slice(0, 5) ?? null
      const mins = ts ? timeStrToMinutes(ts, now) : null
      const isReturn = e.note?.startsWith?.('회차편') ?? false
      const isFrequent = e.note === '수시운행'
      rows.push({
        key: `t-${ts}-${e.note ?? ''}`,
        departStr: ts,
        mins: mins != null && mins >= 0 ? mins : null,
        statusLabel: isFrequent ? '수시운행' : isReturn ? '회차편 탑승' : null,
        isReturn,
      })
    }
  }

  if (rows.length === 0) {
    if (view === 'timeline') {
      return (
        <TimelineRow
          routeCode={`${label}셔틀`}
          direction="한국공대"
          disabled
          disabledLabel="금일 남은 운행 없음"
        />
      )
    }
    return (
      <ScheduleSection
        title={`셔틀 ${label}`}
        subtitle="한국공대"
        type="shuttle"
        routeCode={`셔틀${label}`}
        next={null}
        afterNext={null}
        loading={false}
        disabled
        disabledLabel="금일 남은 운행 없음"
      />
    )
  }

  // 타임라인: 다음~다다다다음까지 펼쳐서 개별 행으로 렌더
  if (view === 'timeline') {
    return (
      <>
        {rows.map((r) => {
          const orderVal = r.mins != null ? r.mins : 1_000_000
          return (
            <TimelineRow
              key={r.key}
              routeCode={`${label}셔틀`}
              direction="한국공대"
              minutes={r.mins}
              statusLabel={r.statusLabel}
              loading={loading}
              order={orderVal}
              onClick={handleClick}
            />
          )
        })}
      </>
    )
  }

  // 리스트: 단일 카드로 다음 + 그 다음 + (추가시간 pills)
  const first = rows[0]
  const second = rows[1]
  const extras = rows.slice(2)
    .map((r) => r.departStr)
    .filter((s) => typeof s === 'string' && s.length > 0)
  // 리스트: SHUTTLE_GROUPS 순서(등교 → 하교) 유지. 타임라인은 행마다 mins 기반.
  const orderVal = view === 'timeline' ? (first?.mins ?? 1_000_000) : 0
  return (
    <ScheduleSection
      title={`셔틀 ${label}`}
      subtitle="한국공대"
      type="shuttle"
      routeCode={`셔틀${label}`}
      next={first?.statusLabel ?? first?.departStr ?? null}
      afterNext={second?.statusLabel ?? second?.departStr ?? null}
      minutesUntil={first?.mins ?? null}
      onClick={handleClick}
      loading={loading}
      extraTimes={extras.length > 0 ? extras : null}
      order={orderVal}
    />
  )
}

// ─── bus group content (동적 API 로드) ─────────────────────────────────────
function BusGroupContent({ busGroup, onCardClick, view = 'list' }) {
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
    // 위치 버튼 좌표는 GBIS 정류장이 아니라 실제 지도 마커 위치를 우선한다.
    const markerCoord = findMarkerCoord(markers, route.route_number, stop?.stop_id ?? null, stopLat, stopLng)
    return {
      code: route.route_number,
      routeId: route.route_id ?? null,
      favCode,
      stopId: stop?.stop_id ?? null,
      destLabel: route.direction_name ?? null,
      originLabel: stopName?.replace('한국공학대학교', '한국공대') ?? null,
      mapLat: markerCoord?.lat ?? stopLat,
      mapLng: markerCoord?.lng ?? stopLng,
      isRealtime: route.is_realtime ?? false,
    }
  })

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        해당 그룹의 버스가 없어요
      </p>
    )
  }

  // 리스트 뷰: 출발지 이름순으로 정렬 (DOM 순서 = 표시 순서)
  // 타임라인 뷰: API 순서 유지, BusRouteSection이 CSS order로 분 단위 정렬
  const displayEntries = view === 'list'
    ? [...entries].sort((a, b) => (a.originLabel ?? '').localeCompare(b.originLabel ?? '', 'ko'))
    : entries

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
      view={view}
    />
  ))
}

// ─── main component ──────────────────────────────────────────────────────────
// 단일 뷰: 상단 pill(버스·지하철·셔틀)로 바로 전환. 디렉토리 단계 없음.
//   /schedule                         → selectedMode(Zustand, persisted) 기준
//   /schedule?type=bus|subway|shuttle → 해당 모드로 진입 (외부 링크 호환)
export default function SchedulePage() {
  const [query, setQuery] = useState(readQuery)

  useEffect(() => {
    const sync = () => setQuery(readQuery())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const storedMode = useAppStore((s) => s.selectedMode)
  const setStoredMode = useAppStore((s) => s.setSelectedMode)
  const scheduleHint = useAppStore((s) => s.scheduleHint)
  const setScheduleHint = useAppStore((s) => s.setScheduleHint)
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const setMapPanTarget = useAppStore((s) => s.setMapPanTarget)

  const initialMode = isValidMode(query.type)
    ? query.type
    : (isValidMode(storedMode) ? storedMode : 'bus')

  const [mode, setMode] = useState(initialMode)
  const [view, setView] = useState('list')
  const [busGroup, setBusGroup] = useState('하교')
  const [subwayGroup, setSubwayGroup] = useState('정왕')
  const [, setShuttleGroup] = useState('등교')
  const [selectedDetail, setSelectedDetail] = useState(null)

  // URL type이 popstate로 바뀌면 mode 동기화
  useEffect(() => {
    if (isValidMode(query.type) && query.type !== mode) {
      setMode(query.type)
    }
  }, [query.type]) // eslint-disable-line react-hooks/exhaustive-deps

  // 지도 오버레이 등에서 scheduleHint로 진입 모드·그룹 지정
  useEffect(() => {
    if (!scheduleHint) return
    if (isValidMode(scheduleHint.mode)) {
      setMode(scheduleHint.mode)
      setStoredMode(scheduleHint.mode)
    }
    if (scheduleHint.group) {
      if (scheduleHint.mode === 'bus') setBusGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'subway') setSubwayGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'shuttle') setShuttleGroup(scheduleHint.group)
    }
    setScheduleHint(null)
  }, [scheduleHint, setScheduleHint, setStoredMode])

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
    mode === 'bus' ? BUS_GROUP_IDS : mode === 'subway' ? SUBWAY_GROUPS : []
  const activeGroupId =
    mode === 'bus' ? busGroup : mode === 'subway' ? subwayGroup : null
  const setActiveGroup =
    mode === 'bus' ? setBusGroup : mode === 'subway' ? setSubwayGroup : () => {}

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark">
      <PageHeader title="시간표" subtitle="노선·역·방향별 전체 시간표" />

      {/* top mode tabs (버스 · 지하철 · 셔틀) + 리스트/타임라인 뷰 토글 */}
      <div className="px-4 pb-2 flex items-center justify-between gap-2 flex-shrink-0">
        <SegmentTabs
          tabs={MODES}
          active={mode}
          onChange={handleModeChange}
        />
        <SegmentTabs
          tabs={[{ id: 'list', label: '리스트' }, { id: 'timeline', label: '타임라인' }]}
          active={view}
          onChange={setView}
          size="sm"
        />
      </div>

      {/* group secondary pills */}
      {mode !== 'shuttle' && groups.length > 0 && (
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
                  }}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* content — 리스트(카드) / 타임라인(세로 라인 + 점) */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
        {view === 'timeline' ? (
          <div style={{ position: 'relative', padding: '4px 4px 0', display: 'flex', flexDirection: 'column' }}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 14,
                top: 12,
                bottom: 12,
                width: 2,
                background: 'var(--tj-line)',
              }}
            />
            {mode === 'bus' && (
              <BusGroupContent
                busGroup={busGroup}
                onCardClick={handleCardClick}
                view="timeline"
              />
            )}
            {mode === 'subway' && (
              <SubwaySection
                stationGroup={subwayGroup}
                onCardClick={handleCardClick}
                view="timeline"
              />
            )}
            {mode === 'shuttle' && SHUTTLE_GROUPS.map((g) => (
              <ShuttleSection
                key={g.id}
                direction={g.direction}
                onCardClick={handleCardClick}
                view="timeline"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {mode === 'bus' && (
              <BusGroupContent
                busGroup={busGroup}
                onCardClick={handleCardClick}
              />
            )}
            {mode === 'subway' && (
              <SubwaySection
                stationGroup={subwayGroup}
                onCardClick={handleCardClick}
              />
            )}
            {mode === 'shuttle' && SHUTTLE_GROUPS.map((g) => (
              <ShuttleSection
                key={g.id}
                direction={g.direction}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* detail modal — 공간 제약 없이 선형 리스트를 그대로 유지.
          즐겨찾기·지도에서 보기 버튼은 모달 헤더에서만 노출. */}
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
