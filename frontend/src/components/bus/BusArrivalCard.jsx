import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { getRouteCardDisplay, ROUTE_WAYPOINTS } from '../dashboard/busStationConfig'

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

// 노선 경유 진행 표시 바
export function RouteProgressStrip({ routeNo, stationId, hasArrival }) {
  const waypoints = ROUTE_WAYPOINTS[routeNo]
  if (!waypoints) return null

  // 현재 조회 정류장 인덱스 → 그 앞 구간이 활성 버스 구간
  const activeSegIdx = hasArrival ? waypoints.findIndex((w) => w.id === stationId) : -1

  return (
    <div className="px-4 pb-3">
      <div className="flex items-start">
        {/* 시작 연결선 */}
        <div className="mt-[6px] w-3 shrink-0 h-px bg-slate-200 dark:bg-slate-600" />

        {/* 각 구간 + 정류장 노드 */}
        {waypoints.map((wp, i) => (
          <Fragment key={wp.id}>
            {/* 구간 선 (이 정류장에 도달하기 전 구간) */}
            <div className="relative flex-1 flex items-center mt-[6px]">
              <div className={`w-full h-px ${activeSegIdx === i ? 'bg-blue-400 dark:bg-blue-500' : 'bg-slate-200 dark:bg-slate-600'}`} />
              {activeSegIdx === i && (
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shadow animate-pulse" />
              )}
            </div>

            {/* 정류장 노드 */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-3 h-3 rounded-full border-2 ${wp.id === stationId ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800'}`} />
              <span className={`text-[9px] mt-0.5 whitespace-nowrap leading-tight ${wp.id === stationId ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {wp.label}
              </span>
            </div>
          </Fragment>
        ))}

        {/* 끝 연결선 */}
        <div className="flex-1 mt-[6px] h-px bg-slate-200 dark:bg-slate-600" />
      </div>
    </div>
  )
}

const ROUTE_COLORS = {
  '6502':  '#E02020',
  '3400':  '#E02020',
  '5200':  '#E02020',
  '시흥33': '#33B5A5',
  '11-A':  '#33B5A5',
  '시흥1':  '#33B5A5',
  '20-1':  '#5096E6',
  '5602':  '#5096E6',
  '99-2':  '#8B5CF6',
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
  return Math.ceil((target - now) / 60000)
}

// 개별 도착 시간 칩
function RealtimeChip({ arrival }) {
  const sec = arrival.arrive_in_seconds ?? 0
  const minutes = Math.ceil(sec / 60)
  return (
    <span className="time-num text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
      {minutes === 0 ? '곧' : `${minutes}분`}
    </span>
  )
}

function TimetableChip({ arrival }) {
  const isTomorrow = arrival.is_tomorrow === true
  const diffMin = minutesUntil(arrival.depart_at, isTomorrow)

  if (isTomorrow) {
    return (
      <>
        <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
          내일
        </span>
        <span className="text-micro text-slate-400 tabular-nums">
          {arrival.depart_at}
        </span>
      </>
    )
  }

  const label = diffMin <= 0 ? '곧' : `${diffMin}분`
  return (
    <>
      <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
        {label}
      </span>
      <span className="text-micro text-slate-400 tabular-nums">
        {arrival.depart_at}
      </span>
    </>
  )
}

// arrivals: 같은 route_no를 가진 배열
export default function BusArrivalCard({ arrivals, stationId, onTimetableClick }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const color = getRouteColor(first.route_no)
  const shown = arrivals.slice(0, 3)
  const desc = getRouteCardDisplay(first.route_no, first.category)

  const inner = (
    <>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <span
          className="min-w-[52px] text-center text-sm font-bold text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0"
          style={{ backgroundColor: color }}
        >
          {first.route_no}
        </span>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {desc ? (
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-tight">
              {desc.dest}
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {first.destination}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {shown.map((a, i) => (
            <span key={i} className="flex flex-col items-center gap-0.5">
              {isTimetable
                ? <TimetableChip arrival={a} />
                : <RealtimeChip arrival={a} />
              }
              {isTimetable
                ? null
                : a.crowded > 0
                  ? <CrowdedBadge level={a.crowded} />
                  : shown.length > 1 && (
                      <span className="text-micro text-slate-400 tabular-nums">{i + 1}번</span>
                    )
              }
            </span>
          ))}
        </div>
        {(isTimetable || !!ROUTE_WAYPOINTS[first.route_no]) && (
          <ChevronRight size={16} className="text-slate-400 shrink-0" />
        )}
      </div>
      <div className={`px-4 flex items-center gap-2 ${!isTimetable && first.avg_interval_minutes != null ? 'pb-1.5' : 'pb-3'}`}>
        {isTimetable ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
            시간표
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-lg font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
            실시간
          </span>
        )}
        {!isTimetable && shown.length > 0 && (
          <span className="text-xs text-slate-400">
            {Math.floor((shown[0].arrive_in_seconds ?? 0) / 60)}분 {Math.round(shown[0].arrive_in_seconds ?? 0) % 60}초 후 도착
          </span>
        )}
      </div>
      {!isTimetable && first.avg_interval_minutes != null && (
        <div className="px-4 pb-3 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <span>🕒</span>
          <span>
            보통 이 시간대 평균{' '}
            <b className="font-semibold text-slate-500 dark:text-slate-400">
              {first.avg_interval_minutes}분 간격
            </b>
          </span>
        </div>
      )}
    </>
  )

  const isClickable = isTimetable || !!ROUTE_WAYPOINTS[first.route_no]

  if (isClickable) {
    return (
      <button
        data-route={first.route_no}
        className="w-full rounded-xl border border-slate-200 dark:border-border-dark shadow-sm bg-white dark:bg-surface-dark text-left pressable"
        onClick={() => onTimetableClick(first.route_id, first.route_no, desc ? `${desc.origin} → ${desc.dest}` : first.destination)}
      >
        {inner}
      </button>
    )
  }

  return (
    <div data-route={first.route_no} className="rounded-xl border border-slate-200 dark:border-border-dark shadow-sm bg-white dark:bg-surface-dark">
      {inner}
    </div>
  )
}
