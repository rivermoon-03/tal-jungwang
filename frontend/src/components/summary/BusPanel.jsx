import useAppStore from '../../stores/useAppStore'
import { useBusTimetableByRoute, useBusArrivals } from '../../hooks/useBus'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import { formatArrival, formatArrivalFromTime } from '../../utils/arrivalTime'

const BUS_GROUPS = ['정왕역', '서울', '기타']

/**
 * 스펙 §2.6 그룹 매핑
 * 정왕역: 20-1, 시흥33 (GBIS 실시간, 한국공학대학교 정류장 224000639)
 * 서울: 3400, 6502 (시간표 기반)
 * 기타: 시흥1 (시간표 기반)
 */
const GROUP_ROUTES = {
  '정왕역': ['20-1', '시흥33'],
  '서울':   ['3400', '6502'],
  '기타':   ['시흥1'],
}

const ROUTE_COLOR = {
  '20-1':   'bg-route-201 text-white',
  '시흥33': 'bg-route-33 text-white',
  '3400':   'bg-navy text-white',
  '6502':   'bg-navy text-white',
  '시흥1':  'bg-route-1 text-white',
}

// 한국공학대학교 정류장 station_id (gbis_station_id=224000639)
const HANKUK_STOP_ID = '224000639'

export default function BusPanel() {
  const selectedBusGroup = useAppStore((s) => s.selectedBusGroup)
  const setBusGroup       = useAppStore((s) => s.setBusGroup)
  const routes            = GROUP_ROUTES[selectedBusGroup] ?? []

  // 정왕역 그룹(20-1, 시흥33)용 실시간 도착 정보 — 30초마다 갱신
  const realtimeArrivals = useBusArrivals(HANKUK_STOP_ID)

  return (
    <div className="space-y-3">
      {/* 그룹 pill 탭 */}
      <div className="flex gap-2">
        {BUS_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setBusGroup(g)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-pill transition-colors
              ${selectedBusGroup === g
                ? 'bg-coral text-white shadow-sm'
                : 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-coral/60'
              }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* 노선별 카드 */}
      <div className="space-y-2">
        {routes.map((route) => (
          <BusRouteRow key={route} route={route} realtimeArrivals={realtimeArrivals} />
        ))}
      </div>
    </div>
  )
}

function BusRouteRow({ route, realtimeArrivals }) {
  const isRealtime = route === '20-1' || route === '시흥33'

  // 실시간 데이터에서 이 노선 항목만 추출 (route_no 기준)
  const liveEntries = isRealtime && realtimeArrivals.data?.arrivals
    ? realtimeArrivals.data.arrivals.filter((a) => a.route_no === route).slice(0, 2)
    : []
  const hasLiveData = liveEntries.length > 0

  // 실시간 데이터가 없을 때 시간표로 폴백 (서비스 시간 외, 오류 등)
  const useFallback = !isRealtime || (!realtimeArrivals.loading && !hasLiveData)
  const timetable = useBusTimetableByRoute(useFallback ? route : null)

  // 로딩: 실시간 노선은 실시간 훅, 비실시간은 시간표 훅
  const loading = isRealtime ? realtimeArrivals.loading : timetable.loading
  const refetch = isRealtime
    ? () => { realtimeArrivals.refetch(); timetable.refetch?.() }
    : timetable.refetch

  // 에러: 실시간 + 폴백도 에러인 경우에만 에러 표시
  const hasError = isRealtime
    ? (realtimeArrivals.error && timetable.error && !timetable.data)
    : (timetable.error && !timetable.data)

  if (loading) {
    return <Skeleton height="3rem" rounded="rounded-xl" />
  }
  if (hasError) {
    return <ErrorState message={`${route} 정보 오류`} onRetry={refetch} className="py-4" />
  }

  // 표시할 도착 항목: 실시간 우선, 없으면 시간표
  const arrivals = hasLiveData
    ? liveEntries
    : extractNext(timetable.data, 2)

  return (
    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl px-3 py-2.5">
      {/* 노선 배지 */}
      <span className={`text-[11px] font-black px-2 py-1 rounded-lg shrink-0 ${ROUTE_COLOR[route] ?? 'bg-gray-400 text-white'}`}>
        {route}
      </span>

      {/* 실시간 배지 — 실제 실시간 데이터를 표시할 때만 */}
      {isRealtime && hasLiveData && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 shrink-0">
          실시간
        </span>
      )}

      {/* 도착 정보 */}
      {arrivals.length === 0 ? (
        <span className="text-xs text-gray-400">운행 정보 없음</span>
      ) : (
        <div className="flex items-center gap-3 min-w-0">
          {arrivals.map((a, i) => (
            <div key={i} className="text-center">
              <p className="text-sm font-black text-gray-900 dark:text-gray-50 leading-none">
                {formatArrivalEntry(a)}
              </p>
              {(a.destination ?? a.dest) && (
                <p className="text-[9px] text-gray-400 mt-0.5 truncate">{a.destination ?? a.dest}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 다양한 API 응답 형태를 통일해서 다음 N개 추출
 * 백엔드 BusTimetableResponse: { route_id, route_name, schedule_type, times: ["HH:MM", ...] }
 * 백엔드 BusArrivalsResponse: { arrivals: [{ arrive_in_seconds, depart_at, destination, ... }] }
 */
function extractNext(data, n = 2) {
  if (!data) return []
  if (Array.isArray(data)) return data.slice(0, n)
  // BusArrivalsResponse
  if (data.arrivals) return data.arrivals.slice(0, n)
  // BusTimetableResponse — times는 문자열 배열
  if (data.times) return data.times.slice(0, n).map((t) => ({ depart_at: t }))
  return []
}

function formatArrivalEntry(a) {
  // 실시간: arrive_in_seconds 필드 우선
  if (a.arrive_in_seconds != null) {
    const label = formatArrival(a.arrive_in_seconds)
    if (label) return label
  }
  // 시간표 기반: depart_at "HH:MM"
  if (a.depart_at) {
    const label = formatArrivalFromTime(a.depart_at)
    if (label) return label
    return a.depart_at
  }
  return '–'
}
