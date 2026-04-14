/**
 * ScheduleSection — card showing route/station with next + after-next times + ⭐ toggle.
 * Props:
 *   title         string  (노선명 or 역명)
 *   subtitle      string  (그룹 설명 등 optional)
 *   type          'bus' | 'subway' | 'shuttle'
 *   routeCode     string
 *   next          string | null  ('07:24' or '3분' etc.)
 *   afterNext     string | null
 *   isFavorite    boolean
 *   onToggleFav   () => void
 *   loading       boolean
 *   lineColor     string | null  (hex override for the dot, e.g. '#F5A623')
 */
import { Star } from 'lucide-react'
import Skeleton from '../common/Skeleton'

const TYPE_COLOR = {
  bus: '#3B82F6',
  subway: '#EAB308',
  shuttle: '#FF385C',
}

const ROUTE_COLOR = {
  '20-1':   '#3B82F6',
  '시흥33': '#14B8A6',
  '시흥1':  '#F97316',
  '3400':   '#8B5CF6',
  '6502':   '#EC4899',
}

export default function ScheduleSection({
  title,
  subtitle,
  type = 'bus',
  routeCode,
  next,
  afterNext,
  isFavorite = false,
  onToggleFav,
  onClick,
  loading = false,
  realtimeOnly = false,
  disabled = false,
  disabledLabel = '일부 역 정보는 지원 예정',
  lineColor = null,
}) {
  const dotColor = lineColor ?? ROUTE_COLOR[routeCode] ?? TYPE_COLOR[type] ?? '#64748B'

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-[18px] border border-slate-100 dark:border-slate-700 shadow-card px-4 py-4 transition-all duration-150 ${
        disabled ? 'opacity-50' : ''
      } ${
        onClick && !disabled
          ? 'cursor-pointer hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 active:scale-[0.98]'
          : ''
      }`}
      onClick={!disabled && onClick ? onClick : undefined}
      role={!disabled && onClick ? 'button' : undefined}
      tabIndex={!disabled && onClick ? 0 : undefined}
      onKeyDown={!disabled && onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {/* top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: dotColor }}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{title}</p>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav?.() }}
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90 flex-shrink-0"
          style={{ transition: 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <Star
            size={18}
            fill={isFavorite ? '#FF385C' : 'none'}
            className={isFavorite ? 'text-coral' : 'text-slate-300 dark:text-slate-600'}
          />
        </button>
      </div>

      {/* arrival times */}
      <div className="mt-3 flex items-baseline gap-3">
        {disabled ? (
          <span className="text-xs text-slate-400 dark:text-slate-500">{disabledLabel}</span>
        ) : realtimeOnly ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            실시간
          </span>
        ) : loading ? (
          <>
            <Skeleton width="4rem" height="1.5rem" rounded="rounded-lg" />
            <Skeleton width="3rem" height="1rem" rounded="rounded-lg" />
          </>
        ) : (
          <>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {next ?? '—'}
            </span>
            {afterNext && (
              <span className="text-sm text-slate-400 font-medium">
                다음 {afterNext}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
