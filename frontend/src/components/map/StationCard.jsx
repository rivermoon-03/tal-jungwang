import { X } from 'lucide-react'
import { useBusArrivals } from '../../hooks/useBus'
import { getBoardingStatus } from '../../utils/boardingStatus'

const MOCK_WALK_SECONDS = 180

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

  return (
    <div className="bg-white border-t border-slate-200 shadow-lg">
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <p className="text-base font-bold text-slate-900">{data.station_name}</p>
        </div>
        <button onClick={onClose} aria-label="닫기" className="text-slate-400 hover:text-slate-600 p-1">
          <X size={20} />
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {data.arrivals.slice(0, 4).map((arrival, i) => {
          const arrivalKey = `${arrival.route_no}-${i}`
          if (arrival.arrival_type === 'timetable') {
            return (
              <div key={arrivalKey} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-[48px] text-center text-sm font-bold text-white bg-slate-500 px-2.5 py-1 rounded">
                  {arrival.route_no}
                </span>
                <span className="flex-1 text-sm text-slate-500">{arrival.destination}</span>
                <span className="text-sm text-slate-600">{arrival.depart_at} 출발</span>
                <span className="text-xs px-2 py-1 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>시간표</span>
              </div>
            )
          }
          const status = getBoardingStatus(arrival.arrive_in_seconds ?? 0, MOCK_WALK_SECONDS)
          const min = Math.floor((arrival.arrive_in_seconds ?? 0) / 60)
          return (
            <div key={arrivalKey} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-[48px] text-center text-sm font-bold text-white bg-navy px-2.5 py-1 rounded whitespace-nowrap">
                {arrival.route_no}
              </span>
              <span className="flex-1 text-sm text-slate-500">{arrival.destination}</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">{min}분</span>
              <span className="text-xs px-2 py-1 rounded font-semibold whitespace-nowrap"
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
