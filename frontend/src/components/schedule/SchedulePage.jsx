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
import { useBusTimetable, useBusTimetableByRoute, useBusArrivals, useBusRoutesByCategory } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'
import { getFirstBusLabel } from '../../utils/arrivalTime'

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

// ─── mode pill config ────────────────────────────────────────────────────────
const MODES = [
  { id: 'subway',  label: '지하철', Icon: TrainFront },
  { id: 'bus',     label: '버스',   Icon: Bus },
  { id: 'shuttle', label: '셔틀',   Icon: TramFront },
]

// 실시간 노선의 조회 대상 정류장 (GBIS stationId) — is_realtime=true 고정값
const REALTIME_STATION_ID = '224000639' // 한국공학대학교

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

// ─── per-route bus section ───────────────────────────────────────────────────
function BusRouteSection({ routeCode, routeId, stopId, favCode, destLabel, originLabel, mapLat, mapLng, isRealtime, isFavorite, onToggleFav, onCardClick }) {
  const now = new Date()
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

  const stationId = isRealtime ? REALTIME_STATION_ID : null
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
        routeId,
        stopId,
        title: destLabel ? `${routeCode} · ${destLabel}` : `${routeCode}번 버스`,
        accentColor: (['3400', '6502', '3401'].includes(routeCode)) ? '#DC2626' : undefined,
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
  const { data, loading, error } = useShuttleSchedule(direction)

  const noSchedule = !loading && (error || !data || (data.directions ?? []).length === 0)
  if (noSchedule) {
    return (
      <ScheduleSection
        title={`셔틀 ${label}`}
        subtitle="한국공학대학교"
        type="shuttle"
        routeCode={`셔틀${label}`}
        next={null}
        afterNext={null}
        isFavorite={isFavorite}
        onToggleFav={() => onToggleFav(`shuttle:${label}`)}
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
      ? `${departAt}에 출발하는 하교버스 회차편 탑승`
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

// ─── bus group content (동적 API 로드) ─────────────────────────────────────
function BusGroupContent({ busGroup, favOnly, isFav, onToggleFav, onCardClick }) {
  const { data: routes, loading } = useBusRoutesByCategory(busGroup)

  if (loading && !routes) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </>
    )
  }

  const routeList = Array.isArray(routes) ? routes : []

  const entries = routeList.map((route) => {
    const stop = route.stops?.[0] ?? null
    const stopName = stop?.name ?? null
    const favCode = stopName != null ? `${busGroup}:${route.route_number}` : route.route_number
    return {
      code: route.route_number,
      routeId: route.route_id ?? null,
      favCode,
      stopId: stop?.stop_id ?? null,
      destLabel: route.direction_name ?? null,
      originLabel: stopName,
      mapLat: stop?.lat ?? null,
      mapLng: stop?.lng ?? null,
      isRealtime: route.is_realtime ?? false,
    }
  })

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
      routeId={e.routeId}
      stopId={e.stopId}
      favCode={e.favCode}
      destLabel={e.destLabel}
      originLabel={e.originLabel}
      mapLat={e.mapLat}
      mapLng={e.mapLng}
      isRealtime={e.isRealtime}
      isFavorite={isFav(e.favCode)}
      onToggleFav={onToggleFav}
      onCardClick={onCardClick}
    />
  ))
}

// ─── main component ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [mode, setMode] = useState('bus')
  const [favOnly, setFavOnly] = useState(false)
  const [busGroup, setBusGroup] = useState('하교')
  const [subwayGroup, setSubwayGroup] = useState('정왕')
  const [shuttleGroup, setShuttleGroup] = useState('등교')
  const [selectedDetail, setSelectedDetail] = useState(null)

  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const scheduleHint = useAppStore((s) => s.scheduleHint)
  const setScheduleHint = useAppStore((s) => s.setScheduleHint)

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
    mode === 'bus' ? BUS_GROUP_IDS : mode === 'subway' ? SUBWAY_GROUPS : SHUTTLE_GROUPS
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
        {mode === 'bus' && (
          <BusGroupContent
            busGroup={busGroup}
            favOnly={favOnly}
            isFav={isFav}
            onToggleFav={handleToggleFav}
            onCardClick={handleCardClick}
          />
        )}

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
        routeId={selectedDetail?.routeId ?? null}
        stopId={selectedDetail?.stopId ?? null}
        direction={selectedDetail?.direction}
        subwayKey={selectedDetail?.subwayKey}
        accentColor={selectedDetail?.accentColor}
        title={selectedDetail?.title ?? ''}
      />
    </div>
  )
}
