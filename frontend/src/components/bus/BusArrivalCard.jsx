import { Fragment } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { getRouteCardDisplay, ROUTE_WAYPOINTS } from '../dashboard/busStationConfig'
import useFavorites from '../../hooks/useFavorites'
import { IMMINENT_THRESHOLD_SEC } from '../../utils/arrivalTime'
import { realtimeSecToMinutes } from './busArrivalDisplay'
import RouteChip from '../common/RouteChip'
import SlotNumber from '../common/SlotNumber'

// ─────────────────────────────────────────────────────────────────────────────
// Exports kept for compatibility with other components (Dashboard ArrivalRow, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const CROWDED_META = {
  1: { label: '여유', cls: 'bg-chip-green-bg text-chip-green-fg dark:bg-chip-green-bg-dark dark:text-chip-green-fg-dark' },
  2: { label: '보통', cls: 'bg-chip-yellow-bg text-chip-yellow-fg dark:bg-chip-yellow-bg-dark dark:text-chip-yellow-fg-dark' },
  3: { label: '혼잡', cls: 'bg-chip-red-bg text-chip-red-fg dark:bg-chip-red-bg-dark dark:text-chip-red-fg-dark' },
  4: { label: '매우혼잡', cls: 'bg-chip-red-bg text-chip-red-fg dark:bg-chip-red-bg-dark dark:text-chip-red-fg-dark' },
}

export function CrowdedBadge({ level }) {
  const meta = CROWDED_META[level]
  if (!meta) return null
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

// 노선 경유 진행 표시 바 — 기존 사용처(ArrivalRow 등) 호환 유지
export function RouteProgressStrip({ routeNo, stationId, hasArrival }) {
  const waypoints = ROUTE_WAYPOINTS[routeNo]
  if (!waypoints) return null

  const activeSegIdx = hasArrival ? waypoints.findIndex((w) => w.id === stationId) : -1

  return (
    <div className="px-4 pb-3">
      <div className="flex items-start">
        <div className="mt-[6px] w-3 shrink-0 h-px bg-line dark:bg-line-dark" />
        {waypoints.map((wp, i) => (
          <Fragment key={wp.id}>
            <div className="relative flex-1 flex items-center mt-[6px]">
              <div className={`w-full h-px ${activeSegIdx === i ? 'bg-accent' : 'bg-line dark:bg-line-dark'}`} />
              {activeSegIdx === i && (
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent shadow" />
              )}
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-3 h-3 rounded-full border-2 ${wp.id === stationId ? 'border-accent bg-surface dark:bg-surface-dark' : 'border-mute-2 dark:border-mute-2-dark bg-surface dark:bg-surface-dark-alt'}`} />
              <span className={`text-[9px] mt-0.5 whitespace-nowrap leading-tight ${wp.id === stationId ? 'font-bold text-accent' : 'text-mute dark:text-mute-dark'}`}>
                {wp.label}
              </span>
            </div>
          </Fragment>
        ))}
        <div className="flex-1 mt-[6px] h-px bg-line dark:bg-line-dark" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 시간 계산
// ─────────────────────────────────────────────────────────────────────────────

function secondsUntil(timeStr, isTomorrow = false) {
  const [hh, mm] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0)
  if (isTomorrow) target.setDate(target.getDate() + 1)
  return Math.floor((target - now) / 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// 새 디자인: 단일 row 카드. 노선 chip + dest + 큰 ETA + 작은 sub.
// 2번째/3번째 ETA, 평균 간격, route progress strip은 카드에서 제거 (상세 sheet로 이동).
// ─────────────────────────────────────────────────────────────────────────────

function computeDisplay(arrivals) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const valid = arrivals.filter((a) =>
    isTimetable ? a.depart_at != null : a.arrive_in_seconds != null
  )
  const shown = valid.slice(0, 2)
  if (shown.length === 0) {
    return { etaValue: '—', etaSub: null, imminent: false }
  }

  if (isTimetable) {
    const a0 = shown[0]
    if (a0.is_tomorrow) {
      return { etaValue: '내일', etaSub: a0.depart_at, imminent: false }
    }
    const sec = secondsUntil(a0.depart_at)
    if (sec < IMMINENT_THRESHOLD_SEC) {
      return { etaValue: '곧', etaSub: a0.depart_at, imminent: true }
    }
    const min = Math.ceil(sec / 60)
    const sub = shown[1]?.depart_at ? `다음 ${shown[1].depart_at}` : a0.depart_at
    return { etaValue: min, etaSub: sub, imminent: false }
  }

  // realtime
  const sec0 = shown[0].arrive_in_seconds ?? 0
  if (sec0 < IMMINENT_THRESHOLD_SEC) {
    return { etaValue: '곧', etaSub: `${Math.max(0, sec0)}초 후`, imminent: true }
  }
  const min0 = realtimeSecToMinutes(sec0)
  let sub = null
  const sec1 = shown[1]?.arrive_in_seconds
  if (sec1 != null) {
    const min1 = realtimeSecToMinutes(sec1)
    sub = `다음 +${min1}분`
  }
  return { etaValue: min0, etaSub: sub, imminent: false }
}

export default function BusArrivalCard({ arrivals, stationId, onTimetableClick }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const desc = getRouteCardDisplay(first.route_no, first.category)
  const destination = desc ? desc.dest : first.destination

  const { etaValue, etaSub, imminent } = computeDisplay(arrivals)
  const crowdedLevel = !isTimetable ? arrivals[0]?.crowded : 0

  const favKey = first.route_no
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)
  const isClickable = isTimetable || !!ROUTE_WAYPOINTS[first.route_no]

  const inner = (
    <div className="flex items-center gap-2.5 px-3 py-[9px]">
      <RouteChip route={first.route_no} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="block truncate text-dest-mob md:text-dest text-text dark:text-text-dark">
          {destination}
        </span>
        {crowdedLevel > 0 && <CrowdedBadge level={crowdedLevel} />}
      </div>
      <span className="text-right whitespace-nowrap shrink-0">
        <Eta value={etaValue} imminent={imminent} />
        {etaSub && (
          <span className="block mt-[1px] text-[9px] font-medium text-mute dark:text-mute-dark tabular-nums">
            {etaSub}
          </span>
        )}
      </span>
      {isClickable && (
        <ChevronRight size={14} aria-hidden="true" className="text-mute dark:text-mute-dark shrink-0" />
      )}
    </div>
  )

  const starButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggleFav({ type: 'bus', label: first.route_no })
      }}
      aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      className="absolute top-1.5 right-1.5 p-1 z-10"
    >
      <Star
        size={14}
        fill={isFavorite ? 'currentColor' : 'none'}
        className={isFavorite ? 'text-state-warn' : 'text-mute-2 dark:text-mute-2-dark'}
      />
    </button>
  )

  const wrapperBase =
    'relative rounded-card bg-surface shadow-card dark:bg-surface-dark dark:border dark:border-line-dark dark:shadow-none'

  if (isClickable) {
    return (
      <div data-route={first.route_no} className="relative">
        <button
          className={`w-full text-left pressable ${wrapperBase}`}
          onClick={() => onTimetableClick(first.route_id, first.route_no, desc ? `${desc.origin} → ${desc.dest}` : first.destination)}
        >
          {inner}
        </button>
        {starButton}
      </div>
    )
  }

  return (
    <div data-route={first.route_no} className={wrapperBase}>
      {inner}
      {starButton}
    </div>
  )
}

function Eta({ value, imminent }) {
  const isText = typeof value === 'string' && !/^\d+$/.test(value)
  const baseCls = `inline-flex items-baseline font-black leading-none tracking-[-0.03em] tabular-nums text-eta-mob md:text-eta-pc ${
    imminent
      ? 'text-imminent dark:text-imminent-dark'
      : 'text-ink dark:text-white'
  }`
  if (isText) {
    return (
      <span className={baseCls}>
        <span className={imminent ? 'relative inline-block' : 'inline-block'}>
          {value}
          {imminent && (
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-[14px] pointer-events-none animate-halo-pulse dark:animate-halo-pulse-dark"
            />
          )}
        </span>
      </span>
    )
  }
  return (
    <span className={baseCls}>
      <SlotNumber value={value} />
      <span className="ml-[1px] text-[10px] font-bold text-mute dark:text-mute-dark">분</span>
    </span>
  )
}
