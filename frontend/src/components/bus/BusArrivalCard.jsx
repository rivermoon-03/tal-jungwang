import { ChevronRight } from 'lucide-react'

// 노선별 배지 배경색
const ROUTE_COLORS = {
  '6502':  '#E02020', // 광역버스 빨강
  '3400':  '#E02020',
  '시흥33': '#33B5A5', // 경기 시내버스 청록
  '시흥1':  '#33B5A5',
  '20-1':  '#5096E6', // 밝은 파랑
}
const DEFAULT_COLOR = '#334155' // slate-700

function getRouteColor(routeNo) {
  return ROUTE_COLORS[routeNo] ?? DEFAULT_COLOR
}


function minutesUntil(timeStr, isTomorrow = false) {
  const [hh, mm] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0)
  if (isTomorrow) target.setDate(target.getDate() + 1)
  return Math.round((target - now) / 60000)
}

export default function BusArrivalCard({ arrival, onTimetableClick }) {
  const isRealtime = arrival.arrival_type === 'realtime'

  if (isRealtime) {
    const totalSec = Math.round(arrival.arrive_in_seconds ?? 0)
    const minutes = Math.floor(totalSec / 60)
    const seconds = totalSec % 60

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 pressable">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
          <span
            className="min-w-[52px] text-center text-sm font-bold text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap"
            style={{ backgroundColor: getRouteColor(arrival.route_no) }}
          >
            {arrival.route_no}
          </span>
          <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 truncate">{arrival.destination}</span>
          <span className="time-num text-xl font-bold text-slate-900 dark:text-slate-100">
            {minutes === 0 ? '곧 출발' : `${minutes}분`}
          </span>
          <span
            className="text-xs px-2 py-1 rounded-lg font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 whitespace-nowrap cursor-default select-none relative group"
            title="실험 중인 기능입니다. 정확성이 떨어지니 주의하세요"
          >
            ±2분 | 테스트 중
            <span className="pointer-events-none absolute right-0 top-full mt-1.5 w-48 rounded-lg bg-slate-800 text-white text-xs font-normal px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 leading-snug">
              실험 중인 기능입니다. 정확성이 떨어지니 주의하세요
            </span>
          </span>
        </div>
        <p className="px-4 pb-3 text-xs text-slate-400">
          {minutes}분 {seconds}초 후 도착
        </p>
      </div>
    )
  }

  // 시간표형 — 탭 가능
  const isTomorrow = arrival.is_tomorrow === true
  const diffMin = minutesUntil(arrival.depart_at, isTomorrow)
  const diffText = diffMin <= 0 ? '곧 출발' : `${diffMin}분 후`

  return (
    <button
      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 text-left pressable"
      onClick={() => onTimetableClick(arrival.route_id, arrival.route_no)}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <span
          className="min-w-[52px] text-center text-sm font-bold text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap"
          style={{ backgroundColor: getRouteColor(arrival.route_no) }}
        >
          {arrival.route_no}
        </span>
        <span className="flex-1" />
        <span className="time-num text-xl font-bold text-slate-900 dark:text-slate-100">{diffText}</span>
        <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
          {isTomorrow ? '내일' : '시간표'}
        </span>
        <ChevronRight size={16} className="text-slate-400 shrink-0" />
      </div>
      <p className="px-4 pb-3 text-xs text-slate-400 flex items-center gap-1.5">
        <span>{isTomorrow ? `내일 ${arrival.depart_at}` : arrival.depart_at} 출발</span>
        {arrival.destination && (
          <>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="truncate">{arrival.destination}</span>
          </>
        )}
      </p>
    </button>
  )
}
