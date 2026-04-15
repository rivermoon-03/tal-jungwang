import useAppStore from '../../stores/useAppStore'
import { useMemo } from 'react'
import { useBusRoutesByCategory, useBusArrivals, useBusTimetable } from '../../hooks/useBus'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import { formatArrival, formatArrivalFromTime } from '../../utils/arrivalTime'

// BusRoute.category 값과 1:1 매칭. DB에서 직접 받아 그룹 구성.
const BUS_CATEGORIES = ['정왕역행', '버스 - 서울행', '버스 - 학교행', '기타']
const CATEGORY_DB_VALUE = {
  '정왕역행': '정왕역행',
  '버스 - 서울행': '서울행',
  '버스 - 학교행': '학교행',
  '기타': '기타',
}

// 노선 번호별 배지 색상 — 디자인 시스템 단순화까지는 매핑 유지
const ROUTE_INLINE_BG = {
  '20-1':  '#2563EB',
  '시흥33': '#0891B2',
  '시흥1':  '#F97316',
  '3400':  '#E02020',
  '6502':  '#E02020',
  '3401':  '#E02020',
}

export default function BusPanel() {
  const selectedBusGroup = useAppStore((s) => s.selectedBusGroup)
  const setBusGroup       = useAppStore((s) => s.setBusGroup)
  const category          = CATEGORY_DB_VALUE[selectedBusGroup] ?? null
  const routesQuery       = useBusRoutesByCategory(category)
  const routes            = routesQuery.data ?? []

  // 실시간 노선은 공통 GBIS 정류장(정왕역행 그룹)에서 묶음 조회.
  const realtimeStationId = useMemo(() => {
    const rt = routes.find((r) => r.is_realtime && r.stops?.[0]?.stop_id != null)
    return rt?.stops?.[0]?.stop_id ?? null
  }, [routes])
  // DB stop id를 gbis_station_id로 매핑해야 하지만 현재 arrivals API는 gbis_station_id(string)를 받음.
  // 정왕역행 그룹만 is_realtime=true인 상황 — 한국공학대학교 정류장 gbis=224000639 고정.
  const realtimeArrivals = useBusArrivals(
    category === '정왕역행' && realtimeStationId ? 224000639 : null
  )

  return (
    <div className="space-y-3">
      {/* 그룹 pill 탭 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {BUS_CATEGORIES.map((g) => {
          const isActive = selectedBusGroup === g
          return (
            <button
              key={g}
              onClick={() => setBusGroup(g)}
              className={`whitespace-nowrap shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors
                ${isActive
                  ? 'shadow-sm'
                  : 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-coral/60'
                }`}
              style={isActive ? { background: '#FF385C', color: '#FFFFFF' } : undefined}
            >
              {g}
            </button>
          )
        })}
      </div>

      {/* 노선 카드 */}
      <div className="space-y-2">
        {routesQuery.loading && <Skeleton height="3rem" rounded="rounded-xl" />}
        {routesQuery.error && !routesQuery.loading && (
          <ErrorState message="노선 정보 오류" onRetry={routesQuery.refetch} className="py-4" />
        )}
        {!routesQuery.loading && routes.length === 0 && (
          <div className="text-xs text-gray-400 py-6 text-center">노선이 없습니다</div>
        )}
        {routes.map((route) => (
          <BusRouteRow
            key={route.route_id}
            route={route}
            realtimeArrivals={realtimeArrivals}
          />
        ))}
      </div>
    </div>
  )
}

function BusRouteRow({ route, realtimeArrivals }) {
  const { route_id, route_number, is_realtime, stops = [] } = route

  // 실시간: 도착정보 목록에서 이 route_number만 추출 (동일 정류장 여러 노선 중)
  const liveEntries = is_realtime && realtimeArrivals.data?.arrivals
    ? realtimeArrivals.data.arrivals.filter((a) => a.route_no === route_number).slice(0, 2)
    : []
  const hasLiveData = liveEntries.length > 0

  // 비실시간 or 실시간 폴백: route_id 기반 시간표
  const useFallback = !is_realtime || (!realtimeArrivals.loading && !hasLiveData)
  const timetable = useBusTimetable(useFallback ? route_id : null)

  const loading = is_realtime ? realtimeArrivals.loading : timetable.loading
  const refetch = is_realtime
    ? () => { realtimeArrivals.refetch(); timetable.refetch?.() }
    : timetable.refetch

  const hasError = is_realtime
    ? (realtimeArrivals.error && timetable.error && !timetable.data)
    : (timetable.error && !timetable.data)

  if (loading) return <Skeleton height="3rem" rounded="rounded-xl" />
  if (hasError) return <ErrorState message={`${route_number} 정보 오류`} onRetry={refetch} className="py-4" />

  const arrivals = hasLiveData ? liveEntries : extractNext(timetable.data, 2)

  // 출발지: 이 route의 첫 번째 stop (이미 방향별로 분리된 route라 origin이 명확)
  const originStop = stops[0]
  const originLabel = originStop
    ? (originStop.sub_name ? `${originStop.name} ${originStop.sub_name}` : originStop.name)
    : null
  const sharedDestination = originLabel ?? (route.direction_name || null)

  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl px-3 py-2.5">
      <span
        className="text-[11px] font-black text-white px-2 py-1 rounded-lg shrink-0 min-w-[44px] text-center"
        style={{ background: ROUTE_INLINE_BG[route_number] ?? '#64748B' }}
      >
        {route_number}
      </span>

      {is_realtime && hasLiveData && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">
          테스트-부정확
        </span>
      )}

      {arrivals.length === 0 ? (
        <span className="text-xs text-gray-400 flex-1">운행 정보 없음</span>
      ) : (
        <div className="flex items-baseline gap-3 flex-1 min-w-0">
          {arrivals.map((a, i) => (
            <span
              key={i}
              className="text-sm font-black text-gray-900 dark:text-gray-50 tabular-nums whitespace-nowrap"
            >
              {formatArrivalEntry(a)}
            </span>
          ))}
        </div>
      )}

      {sharedDestination && (
        <span className="text-[10px] text-gray-400 truncate max-w-[84px] text-right shrink-0">
          {sharedDestination}
        </span>
      )}
    </div>
  )
}

function extractNext(data, n = 2) {
  if (!data) return []
  if (Array.isArray(data)) return data.slice(0, n)
  if (data.arrivals) return data.arrivals.slice(0, n)
  if (data.times) {
    const now = new Date()
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return data.times
      .filter((t) => typeof t === 'string' && t >= nowStr)
      .slice(0, n)
      .map((t) => ({ depart_at: t }))
  }
  return []
}

function formatArrivalEntry(a) {
  if (a.arrive_in_seconds != null) {
    const label = formatArrival(a.arrive_in_seconds)
    if (label) return label
  }
  if (a.depart_at) {
    const label = formatArrivalFromTime(a.depart_at)
    if (label) return label
    return a.depart_at
  }
  return '–'
}
