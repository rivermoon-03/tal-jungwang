/**
 * ScheduleDetailModal — bottom-sheet modal showing full upcoming schedule.
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   type        'bus' | 'subway' | 'shuttle'
 *   routeCode   string  (bus route number, subway station group, shuttle direction label)
 *   direction   number | undefined  (shuttle: 0=등교, 1=하교)
 *   title       string  (display title in modal header)
 */
import { useEffect, useRef } from 'react'
import { X, Clock } from 'lucide-react'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayTimetable } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'

// ─── per-type content components ────────────────────────────────────────────

function BusContent({ routeCode }) {
  const { data, loading, error } = useBusTimetableByRoute(routeCode)

  const now = new Date()
  const allTimes = data?.times ?? []
  const { future, past } = allTimes.reduce(
    (acc, t) => {
      const [h, m] = (t ?? '00:00').split(':').map(Number)
      const d = new Date()
      d.setHours(h, m, 0, 0)
      if (d > now) acc.future.push(t)
      else acc.past.push(t)
      return acc
    },
    { future: [], past: [] },
  )

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!allTimes.length) return <EmptyMsg text="오늘 운행 정보가 없어요" />

  return (
    <div>
      {data?.schedule_type && (
        <p className="text-xs text-slate-400 mb-3">
          {scheduleTypeLabel(data.schedule_type)} 시간표 · 총 {allTimes.length}회
        </p>
      )}
      <TimeList items={future} pastItems={past.slice(-2)} labelPast="이미 지난 시각" />
    </div>
  )
}

function SubwayContent({ routeCode }) {
  // routeCode is the station group ('정왕', '초지', '시흥시청')
  const { data, loading, error } = useSubwayTimetable()
  const now = new Date()
  const nowStr = toHHMM(now)

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!data) return <EmptyMsg text="시간표 정보가 없어요" />

  // Choose up/down based on station — currently only 정왕 has data
  const upTimes = (data.up ?? []).map((t) => t.depart_at)
  const downTimes = (data.down ?? []).map((t) => t.depart_at)

  const upFuture = upTimes.filter((t) => t >= nowStr)
  const downFuture = downTimes.filter((t) => t >= nowStr)

  return (
    <div className="flex flex-col gap-6">
      <DirectionBlock
        label="상행 (왕십리 방면)"
        times={upFuture}
        allCount={upTimes.length}
        destinations={data.up ?? []}
      />
      <DirectionBlock
        label="하행 (인천 방면)"
        times={downFuture}
        allCount={downTimes.length}
        destinations={data.down ?? []}
      />
    </div>
  )
}

function DirectionBlock({ label, times, allCount, destinations }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
        {label} · 남은 {times.length}회 / 오늘 {allCount}회
      </p>
      {times.length === 0 ? (
        <p className="text-xs text-slate-400">오늘 남은 열차가 없어요</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
          {times.slice(0, 30).map((t, i) => {
            const dest = destinations.find((d) => d.depart_at === t)?.destination
            return (
              <div key={i} className="flex flex-col">
                <span className={`text-sm font-bold ${i === 0 ? 'text-coral' : 'text-slate-800 dark:text-slate-200'}`}>
                  {t}
                </span>
                {dest && (
                  <span className="text-[10px] text-slate-400 truncate">{dest}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ShuttleContent({ direction }) {
  const { data, loading, error } = useShuttleSchedule(direction)
  const now = new Date()
  const nowStr = toHHMM(now)

  const dirData = data?.directions?.find((d) => d.direction === direction)
  const times = dirData?.times ?? []
  const future = times.filter((t) => {
    const timeStr = typeof t === 'string' ? t : t?.depart_at ?? ''
    return timeStr.slice(0, 5) >= nowStr
  })
  const past = times.filter((t) => {
    const timeStr = typeof t === 'string' ? t : t?.depart_at ?? ''
    return timeStr.slice(0, 5) < nowStr
  })

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!times.length) return <EmptyMsg text="오늘 셔틀 정보가 없어요" />

  return (
    <div>
      {data?.schedule_name && (
        <p className="text-xs text-slate-400 mb-3">
          {data.schedule_name} · 총 {times.length}회
        </p>
      )}
      <ShuttleTimeList items={future} pastItems={past.slice(-2)} />
    </div>
  )
}

// ─── shared UI helpers ───────────────────────────────────────────────────────

function TimeList({ items, pastItems }) {
  return (
    <div>
      {pastItems?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 mb-1.5">이미 지난 시각</p>
          <div className="grid grid-cols-4 gap-x-3 gap-y-2 opacity-40">
            {pastItems.map((t, i) => (
              <span key={i} className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t}</span>
            ))}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 my-3" />
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">오늘 남은 운행이 없어요</p>
      ) : (
        <div className="grid grid-cols-4 gap-x-3 gap-y-2">
          {items.slice(0, 40).map((t, i) => (
            <span
              key={i}
              className={`text-sm font-bold ${i === 0 ? 'text-coral' : 'text-slate-800 dark:text-slate-200'}`}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ShuttleTimeList({ items, pastItems }) {
  return (
    <div>
      {pastItems?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 mb-1.5">이미 지난 시각</p>
          <div className="grid grid-cols-4 gap-x-3 gap-y-2 opacity-40">
            {pastItems.map((t, i) => {
              const timeStr = typeof t === 'string' ? t : t?.depart_at ?? ''
              return (
                <span key={i} className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {timeStr.slice(0, 5)}
                </span>
              )
            })}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 my-3" />
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">오늘 남은 셔틀이 없어요</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((t, i) => {
            const timeStr = typeof t === 'string' ? t : t?.depart_at ?? ''
            const note = typeof t === 'object' ? t?.note : null
            return (
              <div key={i} className="flex items-center gap-3">
                <span
                  className={`text-sm font-bold w-12 flex-shrink-0 ${
                    i === 0 ? 'text-coral' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {timeStr.slice(0, 5)}
                </span>
                {note && (
                  <span className="text-xs text-slate-400 truncate">{note}</span>
                )}
                {i === 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coral/10 text-coral ml-auto flex-shrink-0">
                    다음
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LoadingList() {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2 mt-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} width="3rem" height="1.25rem" rounded="rounded" />
      ))}
    </div>
  )
}

function ErrorMsg() {
  return (
    <p className="text-sm text-red-400 dark:text-red-500 text-center py-4">
      정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
    </p>
  )
}

function EmptyMsg({ text }) {
  return (
    <p className="text-sm text-slate-400 text-center py-4">{text}</p>
  )
}

function scheduleTypeLabel(type) {
  return type === 'weekday' ? '평일' : type === 'saturday' ? '토요일' : '일/공휴일'
}

function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// ─── modal shell ─────────────────────────────────────────────────────────────

const TYPE_LABEL = { bus: '버스', subway: '지하철', shuttle: '셔틀' }
const TYPE_COLOR = { bus: '#3B82F6', subway: '#EAB308', shuttle: '#FF385C' }

export default function ScheduleDetailModal({ open, onClose, type, routeCode, direction, title }) {
  const sheetRef = useRef(null)

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const accentColor = TYPE_COLOR[type] ?? '#64748B'
  const typeLabel = TYPE_LABEL[type] ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={handleBackdrop}
      aria-modal="true"
      role="dialog"
      aria-label={`${title} 시간표`}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full md:max-w-md bg-white dark:bg-slate-800 rounded-t-[28px] md:rounded-[24px] shadow-2xl flex flex-col"
        style={{ maxHeight: '85dvh' }}
      >
        {/* drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600" />
        </div>

        {/* header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: accentColor }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-slate-900 dark:text-slate-100 truncate leading-tight">
              {title}
            </p>
            <p className="text-xs text-slate-400">{typeLabel} 시간표</p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* today label */}
        <div className="px-5 pt-3 pb-1 flex-shrink-0 flex items-center gap-1.5">
          <Clock size={12} className="text-slate-400" />
          <p className="text-xs text-slate-400">
            오늘 기준 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {type === 'bus' && <BusContent routeCode={routeCode} />}
          {type === 'subway' && <SubwayContent routeCode={routeCode} />}
          {type === 'shuttle' && <ShuttleContent direction={direction} />}
        </div>
      </div>
    </div>
  )
}
