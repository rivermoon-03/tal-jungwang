import useAppStore from '../../stores/useAppStore'
import { useMemo } from 'react'
import { useBusTimetableByRoute, useBusArrivals, useBusStations } from '../../hooks/useBus'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import { formatArrival, formatArrivalFromTime } from '../../utils/arrivalTime'

const BUS_GROUPS = ['정왕역행', '버스 - 서울행', '버스 - 학교행', '기타']

/**
 * 그룹 매핑
 * 정왕역행: 20-1, 시흥33 (GBIS 실시간, 한국공학대학교 정류장 224000639)
 * 버스 - 서울행: 3400, 6502 — 학교/시흥에서 서울 방면 (아웃바운드 시간표)
 * 버스 - 학교행: 3400, 6502 — 서울에서 학교 방면 (인바운드 시간표)
 * 기타: 시흥1
 */
const GROUP_ROUTES = {
  '정왕역행':      ['20-1', '시흥33'],
  '버스 - 서울행': ['3400', '6502'],
  '버스 - 학교행': ['3400', '6502'],
  '기타':         ['시흥1'],
}

// 노선 번호 배지 배경색 — inline style로 명시 (Tailwind 커스텀 클래스 누락 방지)
const ROUTE_INLINE_BG = {
  '20-1':  '#2563EB',
  '시흥33': '#0891B2',
  '시흥1': '#F97316',
  '3400':  '#E02020',
  '6502':  '#E02020',
}

// 한국공학대학교 정류장 station_id (gbis_station_id=224000639)
const HANKUK_STOP_ID = '224000639'

export default function BusPanel() {
  const selectedBusGroup = useAppStore((s) => s.selectedBusGroup)
  const setBusGroup       = useAppStore((s) => s.setBusGroup)
  const routes            = GROUP_ROUTES[selectedBusGroup] ?? []

  // 정왕역 그룹(20-1, 시흥33)용 실시간 도착 정보 — 30초마다 갱신
  const realtimeArrivals = useBusArrivals(HANKUK_STOP_ID)

  // 3400/6502는 그룹별로 다른 정류장 시간표를 봐야 함 (서울행=시화/이마트, 학교행=강남/사당)
  const { data: stationsData } = useBusStations()
  const stopIdFor = useMemo(() => {
    const find = (name) => stationsData?.find((s) => s.name === name)?.station_id ?? null
    return {
      '버스 - 서울행': {
        '3400': find('시화 (3400 시종착)'),
        '6502': find('이마트 (6502·시흥1번 정류장)'),
      },
      '버스 - 학교행': {
        '3400': find('강남역 3400 정류장'),
        '6502': find('사당역 14번 출구'),
      },
    }
  }, [stationsData])

  return (
    <div className="space-y-3">
      {/* 그룹 pill 탭 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {BUS_GROUPS.map((g) => {
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

      {/* 노선별 카드 */}
      <div className="space-y-2">
        {routes.map((route) => (
          <BusRouteRow
            key={`${selectedBusGroup}-${route}`}
            route={route}
            realtimeArrivals={realtimeArrivals}
            stopId={stopIdFor[selectedBusGroup]?.[route] ?? null}
          />
        ))}
      </div>
    </div>
  )
}

function BusRouteRow({ route, realtimeArrivals, stopId = null }) {
  const isRealtime = route === '20-1' || route === '시흥33'

  // 실시간 데이터에서 이 노선 항목만 추출 (route_no 기준)
  const liveEntries = isRealtime && realtimeArrivals.data?.arrivals
    ? realtimeArrivals.data.arrivals.filter((a) => a.route_no === route).slice(0, 2)
    : []
  const hasLiveData = liveEntries.length > 0

  // 실시간 데이터가 없을 때 시간표로 폴백 (서비스 시간 외, 오류 등)
  const useFallback = !isRealtime || (!realtimeArrivals.loading && !hasLiveData)
  const timetable = useBusTimetableByRoute(useFallback ? route : null, { stopId: stopId ?? undefined })

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

  // 방면은 어차피 그룹 내에서 동일 → 첫 번째 도착의 목적지만 우측에 작게 표시
  const sharedDestination = arrivals[0]?.destination ?? arrivals[0]?.dest ?? null

  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl px-3 py-2.5">
      {/* 노선 배지 */}
      <span
        className="text-[11px] font-black text-white px-2 py-1 rounded-lg shrink-0 min-w-[44px] text-center"
        style={{ background: ROUTE_INLINE_BG[route] ?? '#64748B' }}
      >
        {route}
      </span>

      {/* 테스트 배지 — 실제 실시간 데이터를 표시할 때만 */}
      {isRealtime && hasLiveData && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">
          테스트-부정확
        </span>
      )}

      {/* 도착 정보 */}
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

      {/* 방면 — 우측에 작게 */}
      {sharedDestination && (
        <span className="text-[10px] text-gray-400 truncate max-w-[72px] text-right shrink-0">
          {sharedDestination}
        </span>
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
  // BusTimetableResponse — times는 HH:MM 문자열 배열. 과거 시각은 제외하고 앞에서 n개.
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
