import { Bus } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'

const BUS_GROUPS = ['정왕역', '서울', '기타']

/**
 * 스펙 §2.6 그룹 매핑
 * 정왕역: 20-1, 시흥33 (GBIS 실시간)
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

export default function BusPanel() {
  const selectedBusGroup = useAppStore((s) => s.selectedBusGroup)
  const setBusGroup       = useAppStore((s) => s.setBusGroup)
  const routes            = GROUP_ROUTES[selectedBusGroup] ?? []

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
                ? 'bg-coral text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* 노선별 카드 */}
      <div className="space-y-2">
        {routes.map((route) => (
          <BusRouteRow key={route} route={route} />
        ))}
      </div>
    </div>
  )
}

function BusRouteRow({ route }) {
  const { data, loading, error, refetch } = useBusTimetableByRoute(route)

  if (loading) {
    return <Skeleton height="3rem" rounded="rounded-xl" />
  }
  if (error) {
    return <ErrorState message={`${route} 정보 오류`} onRetry={refetch} className="py-4" />
  }

  // data는 배열 or 객체 — 다음 1~2개 도착만 표시
  const arrivals = extractNext(data, 2)

  return (
    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl px-3 py-2.5">
      {/* 노선 배지 */}
      <span className={`text-[11px] font-black px-2 py-1 rounded-lg shrink-0 ${ROUTE_COLOR[route] ?? 'bg-gray-400 text-white'}`}>
        {route}
      </span>

      {/* 도착 정보 */}
      {arrivals.length === 0 ? (
        <span className="text-xs text-gray-400">정보 없음</span>
      ) : (
        <div className="flex items-center gap-3 min-w-0">
          {arrivals.map((a, i) => (
            <div key={i} className="text-center">
              <p className="text-sm font-black text-gray-900 dark:text-gray-50 leading-none">
                {formatArrival(a)}
              </p>
              {a.dest && (
                <p className="text-[9px] text-gray-400 mt-0.5 truncate">{a.dest}</p>
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
 * 가능한 shapes:
 *   배열: [{ time, predictTimeSec, minutesLeft, dest }, ...]
 *   객체: { arrivals: [...] }
 */
function extractNext(data, n = 2) {
  if (!data) return []
  const list = Array.isArray(data) ? data : (data.arrivals ?? data.times ?? [])
  return list.slice(0, n)
}

function formatArrival(a) {
  if (a.minutesLeft != null) return `${a.minutesLeft}분`
  if (a.predictTimeSec != null) return `${Math.ceil(a.predictTimeSec / 60)}분`
  if (a.time) return a.time
  return '–'
}
