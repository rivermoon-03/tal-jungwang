import { ChevronRight } from 'lucide-react'

const CROWDED_META = {
  1: { label: '여유', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  2: { label: '보통', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  3: { label: '혼잡', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  4: { label: '매우혼잡', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
}

export function CrowdedBadge({ level }) {
  const meta = CROWDED_META[level]
  if (!meta) return null
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

const ROUTE_COLORS = {
  '6502':  '#E02020',
  '3400':  '#E02020',
  '시흥33': '#33B5A5',
  '시흥1':  '#33B5A5',
  '20-1':  '#5096E6',
  '5602':  '#5096E6',
}
const DEFAULT_COLOR = '#334155'

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

// 개별 도착 시간 칩
function RealtimeChip({ arrival }) {
  const totalSec = Math.round(arrival.arrive_in_seconds ?? 0)
  const minutes = Math.floor(totalSec / 60)
  return (
    <span className="time-num text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
      {minutes === 0 ? '곧' : `${minutes}분`}
    </span>
  )
}

function TimetableChip({ arrival }) {
  const isTomorrow = arrival.is_tomorrow === true
  const diffMin = minutesUntil(arrival.depart_at, isTomorrow)
  return (
    <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
      {isTomorrow ? `내일 ${arrival.depart_at}` : diffMin <= 0 ? '곧' : `${arrival.depart_at}`}
    </span>
  )
}

// arrivals: 같은 route_no를 가진 배열
export default function BusArrivalCard({ arrivals, onTimetableClick }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const color = getRouteColor(first.route_no)
  const shown = arrivals.slice(0, 3)

  const inner = (
    <>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <span
          className="min-w-[52px] text-center text-sm font-bold text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0"
          style={{ backgroundColor: color }}
        >
          {first.route_no}
        </span>
        <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 truncate min-w-0">
          {first.destination}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {shown.map((a, i) => (
            <span key={i} className="flex flex-col items-center gap-0.5">
              {isTimetable
                ? <TimetableChip arrival={a} />
                : <RealtimeChip arrival={a} />
              }
              {!isTimetable && a.crowded > 0
                ? <CrowdedBadge level={a.crowded} />
                : shown.length > 1 && (
                    <span className="text-micro text-slate-400 tabular-nums">{i + 1}번</span>
                  )
              }
            </span>
          ))}
        </div>
        {isTimetable && (
          <ChevronRight size={16} className="text-slate-400 shrink-0" />
        )}
      </div>
      <div className="px-4 pb-3 flex items-center gap-2">
        {isTimetable ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
            시간표
          </span>
        ) : (
          <span
            className="text-xs px-2 py-1 rounded-lg font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 cursor-default select-none relative group"
            title="실험 중인 기능입니다. 정확성이 떨어지니 주의하세요"
          >
            테스트-부정확
            <span className="pointer-events-none absolute left-0 top-full mt-1.5 w-48 rounded-lg bg-slate-800 text-white text-xs font-normal px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 leading-snug">
              실험 중인 기능입니다. 정확성이 떨어지니 주의하세요
            </span>
          </span>
        )}
        {!isTimetable && shown.length > 0 && (
          <span className="text-xs text-slate-400">
            {Math.floor((shown[0].arrive_in_seconds ?? 0) / 60)}분 {Math.round(shown[0].arrive_in_seconds ?? 0) % 60}초 후 도착
          </span>
        )}
      </div>
    </>
  )

  if (isTimetable) {
    return (
      <button
        className="w-full rounded-xl border border-slate-200 dark:border-border-dark shadow-sm bg-white dark:bg-surface-dark text-left pressable"
        onClick={() => onTimetableClick(first.route_id, first.route_no)}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-border-dark shadow-sm bg-white dark:bg-surface-dark">
      {inner}
    </div>
  )
}
