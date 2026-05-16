import { useRef, useEffect } from 'react'
import { ChevronLeft, BusFront, MapPin, Clock } from 'lucide-react'
import { useBusTimetable, useBusHistoryPreview, useBusArrivalStats } from '../../hooks/useBus'
import { ROUTE_WAYPOINTS } from '../dashboard/busStationConfig'
import { RouteProgressStrip } from './BusArrivalCard'
import BusStatsHeader from './BusStatsHeader'

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
  const routeId = data?.route_id
  const stopId = data?.stop_id
  const { data: statsRes } = useBusArrivalStats(routeId, stopId)
  const stats = statsRes?.stats ?? null
  const dayLabel = statsRes ? ({
    weekday: '평일', saturday: '토요일', sunday: '일/공휴일',
  }[statsRes.day_type] ?? null) : null
  const hourLabel = statsRes?.hour_of_day != null ? `${statsRes.hour_of_day}시` : null

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
        <BusStatsHeader stats={stats} dayLabel={dayLabel} hourLabel={hourLabel} />
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
    <div className="flex flex-col h-full animate-slide-in-right bg-bg dark:bg-bg-dark">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
        <button onClick={onBack} aria-label="뒤로" className="w-9 h-9 rounded-mini bg-line dark:bg-line-dark text-ink dark:text-ink-dark flex items-center justify-center pressable">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-page-ttl text-ink dark:text-ink-dark">{routeNo}번</h2>
            <span className="text-meta font-extrabold text-text dark:text-text-dark bg-line dark:bg-line-dark px-2.5 py-1 rounded-full tracking-tight">
              {isWaypoint ? '실시간' : '시간표'}
            </span>
            {!isWaypoint && data && (
              <span className="text-meta font-extrabold text-text dark:text-text-dark bg-line dark:bg-line-dark px-2.5 py-1 rounded-full tracking-tight">
                {{ weekday: '평일', saturday: '토요일', sunday: '일요일' }[data.schedule_type] ?? data.schedule_type}
              </span>
            )}
          </div>
          {destination && (
            <p className="text-meta font-semibold text-mute dark:text-mute-dark truncate mt-1">{destination}</p>
          )}
        </div>
      </div>

      {/* 실시간 waypoint 노선 전용 뷰 */}
      {isWaypoint ? (
        <RealtimeWaypointDetail routeNo={routeNo} stationId={stationId} />
      ) : (
        <>
          {BOARDING_INFO[routeNo] && (
            <div className="mx-4 mb-3 flex items-start gap-2.5 px-4 py-3 bg-chip-blue-bg dark:bg-chip-blue-bg-dark rounded-card">
              <MapPin size={16} className="text-chip-blue-fg dark:text-chip-blue-fg-dark mt-0.5 shrink-0" />
              <div>
                <p className="text-meta font-extrabold text-chip-blue-fg dark:text-chip-blue-fg-dark tracking-wide">{BOARDING_INFO[routeNo].stop}</p>
                <p className="text-meta font-semibold text-chip-blue-fg dark:text-chip-blue-fg-dark/90 mt-0.5">{BOARDING_INFO[routeNo].desc}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-meta font-semibold text-mute dark:text-mute-dark">불러오는 중...</p>
            </div>
          ) : times.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-meta font-semibold text-mute dark:text-mute-dark">시간표 정보가 없습니다.</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto bg-surface dark:bg-bg-dark pb-16 md:pb-0">
              {nextIndex === -1 && (
                <li className="px-5 py-4 bg-surface-alt dark:bg-surface-dark-alt border-b border-line dark:border-line-dark">
                  <p className="text-meta font-bold text-text dark:text-text-dark">오늘 운행이 끝났습니다</p>
                  <p className="text-meta font-medium text-mute dark:text-mute-dark mt-0.5">내일 첫차: {times[0]}</p>
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
                    className={`relative flex items-center px-5 py-3.5 border-b border-line dark:border-line-dark
                      ${isPast ? 'opacity-35 pointer-events-none' : ''}
                      ${isNext ? 'bg-line4-light dark:bg-blue-950/30' : ''}`}
                  >
                    {isNext && (
                      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-line-4 dark:bg-accent-dark" />
                    )}
                    <span className={`tabular-nums min-w-[60px] tracking-tight ${
                      isNext
                        ? 'text-eta-mob font-black text-line-4 dark:text-accent-dark pl-1.5'
                        : 'text-eta-mob font-bold text-ink dark:text-ink-dark'
                    }`}>
                      {t}
                    </span>
                    {isNext && (
                      <>
                        <span className="text-micro font-extrabold text-white bg-line-4 dark:bg-accent-dark dark:text-ink px-2.5 py-0.5 rounded-full ml-2 tracking-wide">다음</span>
                        <span className="ml-auto text-panel-ttl text-line-4 dark:text-accent-dark">{diffMin}분 후</span>
                      </>
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
