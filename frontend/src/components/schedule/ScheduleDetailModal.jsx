/**
 * ScheduleDetailModal — bottom-sheet modal with full upcoming schedule.
 * - 세로 리스트 + "다음" 배지 + "N분 뒤"
 * - 드래그 손잡이로 스와이프 다운 닫기
 * - BottomDock 위로 띄워지도록 bottom padding 확보
 */
import { useEffect, useRef, useState } from 'react'
import { X, Clock } from 'lucide-react'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayTimetable } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'

// ─── helpers ────────────────────────────────────────────────────────────

function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function minutesUntil(hhmm, now = new Date()) {
  const [h, m] = (hhmm ?? '00:00').split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 60000)
}

function fmtDelta(mins) {
  if (mins <= 0) return '곧 출발'
  if (mins < 60) return `${mins}분 뒤`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`
}

function scheduleTypeLabel(type) {
  return type === 'weekday' ? '평일' : type === 'saturday' ? '토요일' : '일/공휴일'
}

// ─── shared list row ────────────────────────────────────────────────────

function TimeRow({ time, isNext, destination, note, accentColor }) {
  const mins = minutesUntil(time)
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
        isNext
          ? 'bg-coral/10 dark:bg-coral/15 border border-coral/40'
          : 'bg-slate-50 dark:bg-slate-700/40 border border-transparent'
      }`}
    >
      <span
        className={`text-lg font-extrabold tabular-nums ${
          isNext ? 'text-coral' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {time}
      </span>
      {(destination || note) && (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {destination || note}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {isNext && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-coral text-white">
            다음
          </span>
        )}
        <span
          className={`text-xs font-semibold tabular-nums ${
            isNext ? 'text-coral' : 'text-slate-500 dark:text-slate-400'
          }`}
          style={isNext ? { color: accentColor } : undefined}
        >
          {fmtDelta(mins)}
        </span>
      </div>
    </div>
  )
}

function PastRow({ time }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 opacity-50">
      <span className="text-sm text-slate-400 dark:text-slate-500 tabular-nums">{time}</span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">지난 시각</span>
    </div>
  )
}

// ─── per-type content ───────────────────────────────────────────────────

function BusContent({ routeCode, accentColor }) {
  const { data, loading, error } = useBusTimetableByRoute(routeCode)
  const now = new Date()
  const nowStr = toHHMM(now)
  const allTimes = data?.times ?? []
  const future = allTimes.filter((t) => t >= nowStr)
  const past = allTimes.filter((t) => t < nowStr).slice(-2)

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!allTimes.length) return <EmptyMsg text="오늘 운행 정보가 없어요" />

  return (
    <div className="flex flex-col gap-2">
      {data?.schedule_type && (
        <p className="text-xs text-slate-400 mb-1">
          {scheduleTypeLabel(data.schedule_type)} 시간표 · 총 {allTimes.length}회 · 남은 {future.length}회
        </p>
      )}
      {past.map((t) => <PastRow key={`p-${t}`} time={t} />)}
      {future.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">오늘 남은 운행이 없어요</p>
      ) : (
        future.map((t, i) => (
          <TimeRow key={t} time={t} isNext={i === 0} accentColor={accentColor} />
        ))
      )}
    </div>
  )
}

function SubwayContent({ accentColor }) {
  const { data, loading, error } = useSubwayTimetable()
  const now = new Date()
  const nowStr = toHHMM(now)

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!data) return <EmptyMsg text="시간표 정보가 없어요" />

  const upItems = (data.up ?? []).filter((t) => (t.depart_at ?? '') >= nowStr)
  const downItems = (data.down ?? []).filter((t) => (t.depart_at ?? '') >= nowStr)

  return (
    <div className="flex flex-col gap-5">
      <DirectionBlock
        label="상행 (왕십리 방면)"
        items={upItems}
        totalCount={(data.up ?? []).length}
        accentColor={accentColor}
      />
      <DirectionBlock
        label="하행 (인천 방면)"
        items={downItems}
        totalCount={(data.down ?? []).length}
        accentColor={accentColor}
      />
    </div>
  )
}

function DirectionBlock({ label, items, totalCount, accentColor }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
        {label} · 남은 {items.length}회 / 오늘 {totalCount}회
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">오늘 남은 열차가 없어요</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.slice(0, 30).map((t, i) => (
            <TimeRow
              key={`${t.depart_at}-${i}`}
              time={t.depart_at}
              destination={t.destination}
              isNext={i === 0}
              accentColor={accentColor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ShuttleContent({ direction, accentColor }) {
  const { data, loading, error } = useShuttleSchedule(direction)
  const now = new Date()
  const nowStr = toHHMM(now)
  const dirData = data?.directions?.find((d) => d.direction === direction)
  const times = dirData?.times ?? []

  const future = []
  const past = []
  for (const t of times) {
    const timeStr = (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5)
    const note = typeof t === 'object' ? t?.note : null
    if (timeStr >= nowStr) future.push({ time: timeStr, note })
    else past.push({ time: timeStr, note })
  }

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!times.length) return <EmptyMsg text="오늘 셔틀 정보가 없어요" />

  return (
    <div className="flex flex-col gap-2">
      {data?.schedule_name && (
        <p className="text-xs text-slate-400 mb-1">
          {data.schedule_name} · 총 {times.length}회 · 남은 {future.length}회
        </p>
      )}
      {past.slice(-2).map(({ time }, i) => <PastRow key={`p-${i}`} time={time} />)}
      {future.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">오늘 남은 셔틀이 없어요</p>
      ) : (
        future.map(({ time, note }, i) => (
          <TimeRow key={i} time={time} note={note} isNext={i === 0} accentColor={accentColor} />
        ))
      )}
    </div>
  )
}

// ─── shared UI ──────────────────────────────────────────────────────────

function LoadingList() {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width="100%" height="3rem" rounded="rounded-xl" />
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
  return <p className="text-sm text-slate-400 text-center py-4">{text}</p>
}

// ─── modal shell ────────────────────────────────────────────────────────

const TYPE_LABEL = { bus: '버스', subway: '지하철', shuttle: '셔틀' }
const TYPE_COLOR = { bus: '#3B82F6', subway: '#F5A623', shuttle: '#FF385C' }

export default function ScheduleDetailModal({ open, onClose, type, routeCode, direction, title, accentColor }) {
  const sheetRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const startY = useRef(null)

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setDragY(0)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ─ drag-to-dismiss on handle ──────────────────────────────────────────
  function onDragStart(e) {
    const y = e.touches ? e.touches[0].clientY : e.clientY
    startY.current = y
  }
  function onDragMove(e) {
    if (startY.current == null) return
    const y = e.touches ? e.touches[0].clientY : e.clientY
    const dy = Math.max(0, y - startY.current)
    setDragY(dy)
  }
  function onDragEnd() {
    if (startY.current == null) return
    const finalY = dragY
    startY.current = null
    if (finalY > 120) {
      onClose()
    } else {
      setDragY(0)
    }
  }

  if (!open) return null

  const fallbackColor = TYPE_COLOR[type] ?? '#64748B'
  const color = accentColor ?? fallbackColor
  const typeLabel = TYPE_LABEL[type] ?? ''

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      onClick={handleBackdrop}
      aria-modal="true"
      role="dialog"
      aria-label={`${title} 시간표`}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        ref={sheetRef}
        className="relative z-10 w-full md:max-w-md bg-white dark:bg-slate-800 rounded-t-[28px] md:rounded-[24px] shadow-2xl flex flex-col"
        style={{
          maxHeight: '88dvh',
          transform: `translateY(${dragY}px)`,
          transition: startY.current == null ? 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        {/* drag handle — tap/swipe to dismiss */}
        <button
          onClick={onClose}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
          onMouseDown={onDragStart}
          onMouseMove={startY.current != null ? onDragMove : undefined}
          onMouseUp={onDragEnd}
          onMouseLeave={startY.current != null ? onDragEnd : undefined}
          aria-label="닫기 (아래로 드래그)"
          className="flex justify-center pt-3 pb-2 md:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          style={{ touchAction: 'none' }}
        >
          <span className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500" />
        </button>

        {/* header */}
        <div className="flex items-center gap-3 px-5 pt-3 md:pt-4 pb-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: color }}
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

        <div className="px-5 pt-3 pb-1 flex-shrink-0 flex items-center gap-1.5">
          <Clock size={12} className="text-slate-400" />
          <p className="text-xs text-slate-400">
            오늘 기준 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>

        {/* scrollable content — bottom padding 확보해 BottomDock 위로 */}
        <div
          className="flex-1 overflow-y-auto px-4 pt-2"
          style={{ paddingBottom: 'max(7rem, calc(env(safe-area-inset-bottom) + 6rem))' }}
        >
          {type === 'bus' && <BusContent routeCode={routeCode} accentColor={color} />}
          {type === 'subway' && <SubwayContent accentColor={color} />}
          {type === 'shuttle' && <ShuttleContent direction={direction} accentColor={color} />}
        </div>
      </div>
    </div>
  )
}
