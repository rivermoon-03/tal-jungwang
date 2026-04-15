import { X } from 'lucide-react'
import { useBusArrivals } from '../../hooks/useBus'
import { getBoardingStatus } from '../../utils/boardingStatus'

const MOCK_WALK_SECONDS = 180

const ROUTE_COLORS = {
  '6502':  '#E02020',
  '3400':  '#E02020',
  '시흥33': '#33B5A5',
  '시흥1':  '#33B5A5',
  '20-1':  '#5096E6',
}
function getRouteColor(routeNo) {
  return ROUTE_COLORS[routeNo] ?? '#334155'
}

function groupByRoute(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    if (!map.has(a.route_no)) map.set(a.route_no, [])
    map.get(a.route_no).push(a)
  }
  return Array.from(map.values())
}

export default function StationCard({ stationId, onClose }) {
  const { data, loading } = useBusArrivals(stationId)

  if (loading) {
    return (
      <div className="bg-white border-t border-slate-200 shadow-lg px-5 py-4">
        <p className="text-base text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  if (!data || !data.arrivals?.length) {
    return (
      <div className="bg-white border-t border-slate-200 shadow-lg px-5 py-4 flex items-center justify-between">
        <p className="text-base text-slate-500">도착 정보가 없습니다.</p>
        <button onClick={onClose} aria-label="닫기" className="text-slate-400 hover:text-slate-600 p-1">
          <X size={20} />
        </button>
      </div>
    )
  }

  const groups = groupByRoute(data.arrivals)

  return (
    <div className="bg-white border-t border-slate-200 shadow-lg">
      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-base font-bold text-slate-900">{data.station_name}</p>
        <button onClick={onClose} aria-label="닫기" className="text-slate-400 hover:text-slate-600 p-1">
          <X size={20} />
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {groups.slice(0, 4).map((group) => {
          const first = group[0]
          const color = getRouteColor(first.route_no)
          const shown = group.slice(0, 3)

          if (first.arrival_type === 'timetable') {
            return (
              <div key={first.route_no} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-[48px] text-center text-sm font-bold text-white px-2.5 py-1 rounded" style={{ backgroundColor: color }}>
                  {first.route_no}
                </span>
                <span className="flex-1 text-sm text-slate-500 truncate">{first.destination}</span>
                <div className="flex gap-3 items-center">
                  {shown.map((a, i) => (
                    <span key={i} className="text-sm font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {a.depart_at}
                    </span>
                  ))}
                </div>
                <span className="text-xs px-2 py-1 rounded shrink-0" style={{ background: '#f1f5f9', color: '#475569' }}>시간표</span>
              </div>
            )
          }

          const status = getBoardingStatus(first.arrive_in_seconds ?? 0, MOCK_WALK_SECONDS)
          return (
            <div key={first.route_no} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-[48px] text-center text-sm font-bold text-white px-2.5 py-1 rounded whitespace-nowrap" style={{ backgroundColor: color }}>
                {first.route_no}
              </span>
              <span className="flex-1 text-sm text-slate-500 truncate">{first.destination}</span>
              <div className="flex gap-3 items-center">
                {shown.map((a, i) => (
                  <span key={i} className="text-base font-bold tabular-nums text-slate-900 whitespace-nowrap">
                    {Math.floor((a.arrive_in_seconds ?? 0) / 60) === 0 ? '곧' : `${Math.floor((a.arrive_in_seconds ?? 0) / 60)}분`}
                  </span>
                ))}
              </div>
              <span className="text-xs px-2 py-1 rounded font-semibold whitespace-nowrap shrink-0"
                style={{ background: status.bg, color: status.color }}>
                {status.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
