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
import { Star, MapPin } from 'lucide-react'
import Skeleton from '../common/Skeleton'

const TYPE_COLOR = {
  bus: '#3B82F6',
  subway: '#EAB308',
  shuttle: '#FF385C',
}

// 경기 시내버스(파랑) / 마을버스(초록) / 광역버스(빨강) 원칙을 따르는 노선별 색상
const ROUTE_COLOR = {
  '20-1':   '#2563EB',  // 일반 시내
  '시흥33': '#0891B2',  // 지선
  '시흥1':  '#F97316',  // 마을/순환
  '3400':   '#DC2626',  // 경기 광역(빨강)
  '6502':   '#DC2626',  // 경기 광역(빨강)
}

export default function ScheduleSection({
  title,
  subtitle,
  type = 'bus',
  routeCode,
  destLabel = null,
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
  minutesUntil = null,
  extraTimes = null,
  testBadge = false,
  footer = null,
  onShowMap = null,
}) {
  const dotColor = lineColor ?? ROUTE_COLOR[routeCode] ?? TYPE_COLOR[type] ?? '#64748B'
  // 버스 카드는 노선번호를 컬러 pill 배경으로 강조, 그 외(지하철/셔틀)는 작은 점 유지
  const showBadge = type === 'bus' && routeCode

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
          {showBadge ? (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[13px] font-black tracking-tight flex-shrink-0 shadow-sm"
              style={{ background: dotColor, color: '#FFFFFF' }}
            >
              {routeCode}
            </span>
          ) : (
            <span
              className="inline-flex w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: dotColor }}
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{title}</p>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {destLabel && (
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0 self-center">
            {destLabel}
          </span>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onShowMap && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowMap(e) }}
              aria-label="지도에서 보기"
              title="지도에서 보기"
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"
            >
              <MapPin size={18} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFav?.() }}
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"
            style={{ transition: 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <Star
              size={18}
              fill={isFavorite ? '#FF385C' : 'none'}
              className={isFavorite ? 'text-coral' : 'text-slate-300 dark:text-slate-600'}
            />
          </button>
        </div>
      </div>

      {/* arrival times */}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
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
              {(() => {
                const isTime = typeof next === 'string' && /^\d{1,2}:\d{2}$/.test(next)
                return (
                  <span
                    className={
                      isTime
                        ? 'text-2xl font-black text-slate-900 dark:text-slate-100'
                        : 'text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug break-keep'
                    }
                  >
                    {next ?? '—'}
                  </span>
                )
              })()}
              {afterNext && (
                <span className="text-sm text-slate-400 font-medium">
                  다음 {afterNext}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!disabled && !loading && testBadge && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-lg font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 whitespace-nowrap cursor-default select-none"
              title="실험 중인 기능입니다. 정확성이 떨어지니 주의하세요"
            >
              테스트-부정확
            </span>
          )}
          {!disabled && !loading && minutesUntil != null && (
            <span className="text-xs font-bold text-blue-500 dark:text-blue-400">
              {minutesUntil <= 0 ? '곧 출발' : `${minutesUntil}분 뒤`}
            </span>
          )}
        </div>
      </div>

      {footer}

      {/* 추가 시간 (셔틀) */}
      {!disabled && !loading && Array.isArray(extraTimes) && extraTimes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-x-3 gap-y-1">
          {extraTimes.map((t, i) => (
            <span key={`${t}-${i}`} className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
