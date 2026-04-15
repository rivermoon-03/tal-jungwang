/**
 * SchedulePage — 시간표 탭
 * - Mode pill: 지하철 · 버스 · 셔틀
 * - 각 모드별 그룹 pill selector
 * - ⭐ 즐겨찾기만 toggle
 */
import { useState, useEffect } from 'react'
import { TrainFront, Bus, TramFront, Star } from 'lucide-react'
import ScheduleSection from './ScheduleSection'
import ScheduleDetailModal from './ScheduleDetailModal'
import PageHeader from '../layout/PageHeader'
import useAppStore from '../../stores/useAppStore'
import { useBusTimetableByRoute, useBusArrivals, useBusStations } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'

// ─── static section definitions ────────────────────────────────────────────
// 각 route는 { code, stopName? } — stopName이 있으면 해당 정류장의 방면별 시간표 조회
const BUS_GROUPS = [
  {
    id: '정왕역행',
    label: '정왕역행',
    routes: [{ code: '20-1' }, { code: '시흥33' }],
  },
  {
    id: '버스 - 서울행',
    label: '버스 - 서울행',
    routes: [
      { code: '3400', stopName: '시화 (3400 시종착)',             destLabel: '강남행',   originLabel: '시화',   mapLat: 37.342546, mapLng: 126.735365 },
      { code: '6502', stopName: '이마트 (6502·시흥1번 정류장)',   destLabel: '사당행',   originLabel: '이마트', mapLat: 37.345999, mapLng: 126.737995 },
    ],
  },
  {
    id: '버스 - 학교행',
    label: '버스 - 학교행',
    routes: [
      { code: '3400', stopName: '강남역 3400 정류장',             destLabel: '학교행',   originLabel: '강남역', mapLat: 37.498427, mapLng: 127.029829 },
      { code: '6502', stopName: '사당역 14번 출구',               destLabel: '이마트행', originLabel: '사당역', mapLat: 37.476654, mapLng: 126.982610 },
    ],
  },
  {
    id: '기타',
    label: '기타',
    routes: [{ code: '시흥1' }],
  },
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

// ─── mode pill config ────────────────────────────────────────────────────────
const MODES = [
  { id: 'subway',  label: '지하철', Icon: TrainFront },
  { id: 'bus',     label: '버스',   Icon: Bus },
  { id: 'shuttle', label: '셔틀',   Icon: TramFront },
]

// Routes that are realtime-only (no static timetable available)
const REALTIME_ONLY_ROUTES = new Set(['20-1', '시흥33'])

// 실시간 노선의 조회 대상 정류장 (GBIS stationId)
const REALTIME_ROUTE_STATION = {
  '20-1':   '224000639', // 한국공학대학교
  '시흥33': '224000639', // 한국공학대학교
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function timeStrToMinutes(timeStr, now) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return Math.round((d - now) / 60000)
}

// ─── per-route bus section ───────────────────────────────────────────────────
function BusRouteSection({ routeCode, stopId, favCode, destLabel, originLabel, mapLat, mapLng, isFavorite, onToggleFav, onCardClick }) {
  const titleText = destLabel
    ? (originLabel ? `${destLabel} · ${originLabel} 출발` : destLabel)
    : routeCode
  const setMapPanTarget = useAppStore((s) => s.setMapPanTarget)
  const handleShowOnMap = (e) => {
    e.stopPropagation()
    if (mapLat == null || mapLng == null) return
    setMapPanTarget({ lat: mapLat, lng: mapLng })
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const onShowMap = (mapLat != null && mapLng != null) ? handleShowOnMap : null

  const isRealtimeOnly = REALTIME_ONLY_ROUTES.has(routeCode)
  const stationId = isRealtimeOnly ? REALTIME_ROUTE_STATION[routeCode] : null
  const { data: timetableData, loading: timetableLoading } = useBusTimetableByRoute(
    isRealtimeOnly ? null : routeCode,
    stopId ? { stopId } : undefined,
  )
  const { data: arrivalsData, loading: arrivalsLoading } = useBusArrivals(stationId)

  if (isRealtimeOnly) {
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
    if (firstMin == null) nextLabel = '정보 없음'
    else if (firstMin <= 0) nextLabel = '곧 도착'
    else nextLabel = `${firstMin}분 뒤`

    const favKey = favCode ?? routeCode
    return (
      <ScheduleSection
        title={titleText}
        subtitle={first?.destination ? `실시간 · ${first.destination}행` : '실시간'}
        type="bus"
        routeCode={routeCode}
        destLabel={null}
        next={nextLabel}
        afterNext={secondMin != null ? (secondMin <= 0 ? '곧 도착' : `${secondMin}분 뒤`) : null}
        minutesUntil={null}
        isFavorite={isFavorite}
        onToggleFav={() => onToggleFav(favKey)}
        loading={arrivalsLoading && matches.length === 0}
        testBadge
        onShowMap={onShowMap}
      />
    )
  }

  const allTimes = timetableData?.times ?? []
  const now = new Date()
  const future = allTimes
    .map((t) => {
      const [h, m] = (t ?? '00:00').split(':')
      const d = new Date()
      d.setHours(Number(h), Number(m), 0, 0)
      return d
    })
    .filter((d) => d > now)
    .sort((a, b) => a - b)

  const toStr = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null

  const nextStr = toStr(future[0]) ?? '—'
  const mins = !future[0] ? null : Math.max(0, Math.round((future[0] - now) / 60000))

  const favKey = favCode ?? routeCode
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
      isFavorite={isFavorite}
      onToggleFav={() => onToggleFav(favKey)}
      onClick={() => onCardClick({
        type: 'bus',
        routeCode,
        stopId,
        title: destLabel ? `${routeCode} · ${destLabel}` : `${routeCode}번 버스`,
        accentColor: (routeCode === '3400' || routeCode === '6502') ? '#DC2626' : undefined,
      })}
      loading={timetableLoading}
      onShowMap={onShowMap}
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
function SubwaySection({ stationGroup, isFav, onToggleFav, onCardClick }) {
  const { data, loading } = useSubwayNext()
  const directions = SUBWAY_DIRECTIONS[stationGroup] ?? []
  const now = new Date()

  if (directions.length === 0) {
    return (
      <ScheduleSection
        title={stationGroup}
        subtitle="지하철"
        type="subway"
        routeCode={stationGroup}
        next={null}
        afterNext={null}
        isFavorite={false}
        onToggleFav={() => {}}
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
          const depart = data?.[key]?.depart_at ?? null
          const mins = depart ? timeStrToMinutes(depart, now) : null
          const favCode = `subway:${stationGroup}:${key}`
          return (
            <ScheduleSection
              key={`${stationGroup}:${key}`}
              title={`${stationGroup} ${label}`}
              subtitle={dir.subtitle}
              type="subway"
              routeCode={favCode}
              next={depart}
              afterNext={null}
              minutesUntil={mins != null && mins >= 0 ? mins : null}
              isFavorite={isFav(favCode)}
              onToggleFav={() => onToggleFav(favCode)}
              onClick={() => onCardClick({ type: 'subway', routeCode: stationGroup, subwayKey: key, accentColor: dir.color, title: `${stationGroup}역 ${dir.subtitle} ${label}` })}
              loading={loading}
              lineColor={dir.color}
            />
          )
        }),
      ])}
    </>
  )
}

// ─── shuttle section ─────────────────────────────────────────────────────────
function ShuttleSection({ direction, isFavorite, onToggleFav, onCardClick }) {
  const label = direction === 0 ? '등교' : '하교'
  const { data, loading } = useShuttleSchedule(direction)

  const now = new Date()
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const dirData = data?.directions?.find((d) => d.direction === direction)

  // note 판별: 수시운행 / 회차편은 정확한 시간 대신 상태 라벨로 표시
  const rawEntries = (dirData?.times ?? []).map((t) =>
    typeof t === 'string' ? { depart_at: t, note: null } : { depart_at: t?.depart_at ?? '', note: t?.note ?? null }
  )
  const futureEntries = rawEntries.filter((e) => (e.depart_at ?? '').slice(0, 5) >= nowStr)

  // 수시운행 구간 판단
  const hasPastFrequent = rawEntries.some((e) => e.note === '수시운행' && (e.depart_at ?? '').slice(0, 5) <= nowStr)
  const inFrequent = hasPastFrequent && futureEntries[0]?.note === '수시운행'

  const firstEntry = futureEntries[0]
  const firstIsReturn = firstEntry?.note?.startsWith?.('회차편') ?? false

  let nextDisplay = firstEntry ? firstEntry.depart_at.slice(0, 5) : null
  let firstMins = nextDisplay ? timeStrToMinutes(nextDisplay, now) : null
  if (inFrequent) {
    // 수시운행 종료 시각 = 현재 이후 첫 비(非)수시운행 편의 depart_at
    const endEntry = futureEntries.find((e) => e.note !== '수시운행')
    const endAt = endEntry?.depart_at?.slice(0, 5)
    nextDisplay = endAt ? `${endAt}까지 수시운행` : '수시운행 중'
    firstMins = null
  } else if (firstIsReturn) {
    const departAt = firstEntry?.depart_at?.slice(0, 5)
    nextDisplay = departAt
      ? `${departAt}에 출발하는 ${label}버스 회차편 탑승`
      : '회차편 탑승'
    firstMins = null
  }

  const extra = futureEntries.slice(1, 4).map((e) => {
    if (e.note === '수시운행') return '수시운행'
    if (e.note?.startsWith?.('회차편')) return '회차편 탑승'
    return e.depart_at.slice(0, 5)
  })

  return (
    <ScheduleSection
      title={`셔틀 ${label}`}
      subtitle="한국공학대학교"
      type="shuttle"
      routeCode={`셔틀${label}`}
      next={nextDisplay}
      afterNext={null}
      minutesUntil={firstMins != null && firstMins >= 0 ? firstMins : null}
      extraTimes={extra}
      isFavorite={isFavorite}
      onToggleFav={() => onToggleFav(`shuttle:${label}`)}
      onClick={() => onCardClick({ type: 'shuttle', routeCode: `셔틀${label}`, direction, title: `셔틀버스 ${label}` })}
      loading={loading}
    />
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [mode, setMode] = useState('bus')
  const [favOnly, setFavOnly] = useState(false)
  const [busGroup, setBusGroup] = useState('정왕역행')
  const [subwayGroup, setSubwayGroup] = useState('정왕')
  const [shuttleGroup, setShuttleGroup] = useState('등교')
  const [selectedDetail, setSelectedDetail] = useState(null)

  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const scheduleHint = useAppStore((s) => s.scheduleHint)
  const setScheduleHint = useAppStore((s) => s.setScheduleHint)

  // 정류장명 → station_id 해석 (버스 방면별 시간표 조회에 사용)
  const { data: stationsData } = useBusStations()
  const stationNameToId = (stationsData ?? []).reduce((acc, s) => {
    acc[s.name] = s.station_id
    return acc
  }, {})

  useEffect(() => {
    if (!scheduleHint) return
    if (scheduleHint.mode) setMode(scheduleHint.mode)
    if (scheduleHint.group) {
      if (scheduleHint.mode === 'bus') setBusGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'subway') setSubwayGroup(scheduleHint.group)
      else if (scheduleHint.mode === 'shuttle') setShuttleGroup(scheduleHint.group)
    }
    setScheduleHint(null)
  }, [scheduleHint, setScheduleHint])

  function isFav(code) {
    return favorites.routes?.includes(code) ?? false
  }

  function handleToggleFav(code) {
    toggleFavoriteRoute(code)
  }

  function handleCardClick(detail) {
    setSelectedDetail(detail)
  }

  function handleModalClose() {
    setSelectedDetail(null)
  }

  const groups =
    mode === 'bus' ? BUS_GROUPS : mode === 'subway' ? SUBWAY_GROUPS : SHUTTLE_GROUPS
  const activeGroupId =
    mode === 'bus' ? busGroup : mode === 'subway' ? subwayGroup : shuttleGroup
  const setActiveGroup =
    mode === 'bus' ? setBusGroup : mode === 'subway' ? setSubwayGroup : setShuttleGroup

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in-up">
      <PageHeader title="시간표" subtitle="노선별 전체 시간표" />
      {/* controls */}
      <div className="px-4 pt-2 pb-2 flex flex-col gap-2 flex-shrink-0 bg-slate-50 dark:bg-slate-900">
        {/* mode + fav toggle row */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1">
            {MODES.map(({ id, label, Icon }) => {
              const isActive = mode === id
              return (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all pressable ${
                    isActive
                      ? 'shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  style={isActive ? { background: '#1b3a6e', color: '#FFFFFF' } : undefined}
                >
                  <Icon size={13} color={isActive ? '#FFFFFF' : undefined} />
                  {label}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all pressable ml-auto ${
              favOnly
                ? 'shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
            style={favOnly ? { background: '#FF385C', color: '#FFFFFF' } : undefined}
          >
            <Star size={12} fill={favOnly ? 'currentColor' : 'none'} />
            즐겨찾기만
          </button>
        </div>

        {/* group pill selector (셔틀은 등·하교 둘 다 보여주므로 셀렉터 숨김) */}
        {mode !== 'shuttle' && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
          {groups.map((g) => {
            const isActive = activeGroupId === g.id
            return (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all pressable flex-shrink-0 ${
                  isActive
                    ? 'shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
                style={isActive ? { background: '#1b3a6e', color: '#FFFFFF' } : undefined}
              >
                {g.label}
              </button>
            )
          })}
        </div>
        )}
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6 flex flex-col gap-2">
        {mode === 'bus' && (() => {
          const group = BUS_GROUPS.find((g) => g.id === busGroup)
          const rawRoutes = group?.routes ?? []
          // 즐겨찾기 key는 방향 구분을 위해 group.id와 조합
          const entries = rawRoutes.map((r) => ({
            ...r,
            favCode: r.stopName ? `${group.id}:${r.code}` : r.code,
            stopId: r.stopName ? (stationNameToId[r.stopName] ?? null) : null,
            destLabel: r.destLabel ?? null,
            originLabel: r.originLabel ?? null,
            mapLat: r.mapLat ?? null,
            mapLng: r.mapLng ?? null,
          }))
          const visible = entries.filter((e) => !favOnly || isFav(e.favCode))
          if (visible.length === 0) {
            return (
              <p className="py-8 text-center text-sm text-slate-400">
                {favOnly ? '즐겨찾기된 버스가 없어요' : '해당 그룹의 버스가 없어요'}
              </p>
            )
          }
          return visible.map((e) => (
            <BusRouteSection
              key={e.favCode}
              routeCode={e.code}
              stopId={e.stopId}
              favCode={e.favCode}
              destLabel={e.destLabel}
              originLabel={e.originLabel}
              mapLat={e.mapLat}
              mapLng={e.mapLng}
              isFavorite={isFav(e.favCode)}
              onToggleFav={handleToggleFav}
              onCardClick={handleCardClick}
            />
          ))
        })()}

        {mode === 'subway' && (() => {
          const stationKeys = (SUBWAY_DIRECTIONS[subwayGroup] ?? []).flatMap((d) => [d.upKey, d.downKey])
          const anyFav = stationKeys.some((k) => isFav(`subway:${subwayGroup}:${k}`))
          if (favOnly && !anyFav) {
            return (
              <p className="py-8 text-center text-sm text-slate-400">
                즐겨찾기된 지하철 방향이 없어요
              </p>
            )
          }
          return (
            <SubwaySection
              stationGroup={subwayGroup}
              isFav={isFav}
              onToggleFav={handleToggleFav}
              onCardClick={handleCardClick}
            />
          )
        })()}

        {mode === 'shuttle' && (() => {
          const visible = SHUTTLE_GROUPS.filter((g) => !favOnly || isFav(`shuttle:${g.label}`))
          if (visible.length === 0) {
            return (
              <p className="py-8 text-center text-sm text-slate-400">
                즐겨찾기된 셔틀이 없어요
              </p>
            )
          }
          return visible.map((g) => (
            <ShuttleSection
              key={g.id}
              direction={g.direction}
              isFavorite={isFav(`shuttle:${g.label}`)}
              onToggleFav={handleToggleFav}
              onCardClick={handleCardClick}
            />
          ))
        })()}
      </div>

      {/* detail modal */}
      <ScheduleDetailModal
        open={selectedDetail != null}
        onClose={handleModalClose}
        type={selectedDetail?.type}
        routeCode={selectedDetail?.routeCode}
        direction={selectedDetail?.direction}
        subwayKey={selectedDetail?.subwayKey}
        accentColor={selectedDetail?.accentColor}
        title={selectedDetail?.title ?? ''}
      />
    </div>
  )
}
