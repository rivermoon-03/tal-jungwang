import { useRef, useEffect } from 'react'
import { ChevronLeft, BusFront, MapPin, Clock } from 'lucide-react'
import { useBusTimetable, useBusHistoryPreview } from '../../hooks/useBus'
import { ROUTE_WAYPOINTS } from '../dashboard/busStationConfig'
import { RouteProgressStrip } from './BusArrivalCard'

const BOARDING_INFO = {
  '6502': { stop: '이마트', desc: '육교 건너 이마트 정류장에서 탑승하세요' },
  '3401': { stop: '이마트', desc: '육교 건너 이마트 정류장에서 탑승하세요' },
  '3400': { stop: '본캠 시화버스터미널', desc: '토비동산에서 내려와 횡단보도 건너기 전 정류장에서 탑승하세요' },
}

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

// 실시간 waypoint 노선 상세 뷰: route strip + 과거 도착 이력
function RealtimeWaypointDetail({ routeNo, stationId }) {
  const { data, loading } = useBusHistoryPreview(routeNo)
  const columns = data?.columns ?? []

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-bg-dark pb-16 md:pb-0">
      {/* 노선 경유 막대 */}
      <div className="pt-4 pb-2 bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-border-dark">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-4 mb-3 uppercase tracking-wide">
          경유 노선
        </p>
        <RouteProgressStrip
          routeNo={routeNo}
          stationId={stationId}
          hasArrival={true}
        />
      </div>

      {/* 과거 도착 이력 */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Clock size={13} className="text-slate-400" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            과거 도착 기록
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-4 text-center">불러오는 중...</p>
        ) : columns.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">아직 도착 기록이 없습니다</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {columns.map((col) => (
              <div
                key={col.date}
                className="shrink-0 w-28 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark overflow-hidden"
              >
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-border-dark">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{col.label}</p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">{col.day_label}</p>
                </div>
                <ul className="py-1">
                  {col.times.length === 0 ? (
                    <li className="px-3 py-1.5 text-xs text-slate-300">기록 없음</li>
                  ) : (
                    col.times.map((t, i) => (
                      <li key={i} className="px-3 py-1 text-sm font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                        {t}
                      </li>
                    ))
                  )}
                </ul>
                <p className="px-3 pb-2 text-[9px] text-slate-400">총 {col.totalCount}회</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BusTimetableDetail({ routeId, routeNo, destination, stationId, onBack }) {
  const isWaypoint = !!ROUTE_WAYPOINTS[routeNo]

  const { data, loading } = useBusTimetable(isWaypoint ? null : routeId)
  const nextRef = useRef(null)

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const times = data?.times ?? []
  const nextIndex = times.findIndex((t) => timeToMinutes(t) > nowMin)

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [nextIndex, loading])

  return (
    <div className="flex flex-col h-full animate-slide-in-right">
      <div className="flex items-center gap-2 bg-navy text-white px-4 py-4">
        <button onClick={onBack} className="p-0.5 -ml-1 rounded">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <BusFront size={20} strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold leading-tight">{routeNo}번 {isWaypoint ? '실시간 상세' : '시간표'}</h2>
          {destination && (
            <p className="text-xs opacity-75 truncate">{destination}</p>
          )}
        </div>
        {!isWaypoint && data && (
          <span className="ml-auto text-sm opacity-75 shrink-0">
            {{ weekday: '평일', saturday: '토요일', sunday: '일요일' }[data.schedule_type] ?? data.schedule_type}
          </span>
        )}
      </div>

      {/* 실시간 waypoint 노선 전용 뷰 */}
      {isWaypoint ? (
        <RealtimeWaypointDetail routeNo={routeNo} stationId={stationId} />
      ) : (
        <>
          {BOARDING_INFO[routeNo] && (
            <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900">
              <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mb-0.5">{BOARDING_INFO[routeNo].stop}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">{BOARDING_INFO[routeNo].desc}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-base text-slate-400">불러오는 중...</p>
            </div>
          ) : times.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-base text-slate-400">시간표 정보가 없습니다.</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto bg-white dark:bg-bg-dark pb-16 md:pb-0">
              {nextIndex === -1 && (
                <li className="px-5 py-4 bg-slate-50 dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">오늘 운행이 끝났습니다</p>
                  <p className="text-xs text-slate-400 mt-0.5">내일 첫차: {times[0]}</p>
                </li>
              )}
              {times.map((t, i) => {
                const isPast = timeToMinutes(t) <= nowMin
                const isNext = i === nextIndex
                const diffMin = Math.round(timeToMinutes(t) - nowMin)

                return (
                  <li
                    key={i}
                    ref={isNext ? nextRef : null}
                    className={`flex items-center px-5 py-3 border-b border-slate-100 dark:border-slate-800
                      ${isPast ? 'opacity-35 pointer-events-none' : ''}
                      ${isNext ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                  >
                    <span className={`time-num text-lg font-semibold min-w-[56px]
                      ${isNext ? 'text-navy dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {t}
                    </span>
                    {isNext && (
                      <span className="ml-auto text-base font-bold text-navy dark:text-blue-400">{diffMin}분 후</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
