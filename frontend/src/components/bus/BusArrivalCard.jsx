import { Fragment } from 'react'
import { Star } from 'lucide-react'
import {
  getRouteDisplayConfig,
  getRouteCategory,
  getRoutePath,
  ROUTE_WAYPOINTS,
} from '../dashboard/busStationConfig'
import useFavorites from '../../hooks/useFavorites'
import { IMMINENT_THRESHOLD_SEC } from '../../utils/arrivalTime'
import { realtimeSecToMinutes } from './busArrivalDisplay'
import MiniTrack from './MiniTrack'

// ─────────────────────────────────────────────────────────────────────────────
// CrowdedBadge / RouteProgressStrip — 외부 호환을 위해 유지
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
    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

// 노선 경유 진행 표시 바 — 기존 사용처(BusTimetableDetail, ScheduleDetailModal 등) 호환 유지
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
// chip · 카테고리 컬러
// ─────────────────────────────────────────────────────────────────────────────

const CHIP_BG = {
  express: 'bg-line-express',
  trunk:   'bg-line-201',
  local:   'bg-line-33',
}
const FROM_COLOR = {
  express: 'text-line-express',
  trunk:   'text-line-201',
  local:   'text-line-33',
}

// ─────────────────────────────────────────────────────────────────────────────
// head label 정규화 — "방면"은 "행"으로, 이미 "행"으로 끝나면 중복 추가 금지.
// (예: destination="학교행"이면 "학교행행"이 되는 버그 방지)
// ─────────────────────────────────────────────────────────────────────────────
function toHeadLabel(label) {
  if (!label) return ''
  if (/방면/.test(label)) return label.replace(/\s*방면/g, '행')
  return label.endsWith('행') ? label : `${label}행`
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

function computeDisplay(arrivals) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  // realtime: 0초 이하 항목은 "이미 출발"로 보고 제외 — tick 카운트다운이 0에 도달한
  // 차량이 "곧 0초 후"로 영원히 멈춰 있는 현상 방지. 다음 차가 있으면 그게 primary로
  // 올라오고, 없으면 placeholder "—" 표시. backend _compute_realtime_eta(>0 필터)와 통일.
  const valid = arrivals.filter((a) =>
    isTimetable
      ? a.depart_at != null
      : a.arrive_in_seconds != null && a.arrive_in_seconds > 0
  )
  const shown = valid.slice(0, 2)
  if (shown.length === 0) {
    return { etaValue: '—', etaSub: null, imminent: false, stats: null }
  }
  if (isTimetable) {
    const a0 = shown[0]
    if (a0.is_tomorrow) {
      return { etaValue: '내일', etaSub: a0.depart_at, imminent: false, stats: null }
    }
    const sec = secondsUntil(a0.depart_at)
    if (sec < IMMINENT_THRESHOLD_SEC) {
      return { etaValue: '곧', etaSub: a0.depart_at, imminent: true, stats: null }
    }
    const min = Math.ceil(sec / 60)
    const sub = shown[1]?.depart_at ? `다음 ${shown[1].depart_at}` : a0.depart_at
    return { etaValue: min, etaSub: sub, imminent: false, stats: null }
  }
  const stats = arrivals[0]?.stats ?? null
  const sec0 = shown[0].arrive_in_seconds ?? 0
  if (sec0 < IMMINENT_THRESHOLD_SEC) {
    return { etaValue: '곧', etaSub: `${Math.max(0, sec0)}초 후`, imminent: true, stats }
  }
  const min0 = realtimeSecToMinutes(sec0)
  // sub 표시 우선순위: (1) 다음 한 대(secondary) > (2) stats 분포 > (3) 없음.
  // GBIS가 두 번째 버스를 잡았는데 stats 라벨에 가려져 "다음 한 대" 정보가 사라지는 버그 방지.
  // 시간표 분기 (line 115)의 "다음 HH:MM"과 표기를 통일.
  const sec1 = shown[1]?.arrive_in_seconds
  let sub = null
  if (sec1 != null) {
    const arriveAt = new Date(Date.now() + sec1 * 1000)
    const hh = String(arriveAt.getHours()).padStart(2, '0')
    const mm = String(arriveAt.getMinutes()).padStart(2, '0')
    sub = `다음 ${hh}:${mm}`
  } else if (stats?.tolerance_min != null) {
    sub = `보통 ±${stats.tolerance_min}분`
  }
  return { etaValue: min0, etaSub: sub, imminent: false, stats }
}

// ─────────────────────────────────────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────────────────────────────────────

export default function BusArrivalCard({ arrivals, stationId, onTimetableClick }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const cfg = getRouteDisplayConfig(first.route_no)
  const category = cfg?.category ?? getRouteCategory(first.route_no)
  const path = getRoutePath(first.route_no, first.category) ?? null

  const origin = path?.origin ?? first.origin ?? ''
  const waypoints = path?.waypoints ?? []
  const terminus = path?.terminus ?? first.destination ?? ''
  // path.label / destination 어느 쪽이든 이미 "행"으로 끝나는 케이스에서 "학교행행"
  // 같은 중복이 발생하지 않도록 toHeadLabel로 정규화.
  const headLabel = toHeadLabel(path?.label ?? first.destination ?? '')

  const { etaValue, etaSub, imminent } = computeDisplay(arrivals)
  const crowdedLevel = !isTimetable ? arrivals[0]?.crowded : 0

  const favKey = first.route_no
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)

  // 정보 없음 상태 — 트랙 / from-line 회색 처리
  const muted = etaValue === '—'

  const chipBg = CHIP_BG[category] ?? CHIP_BG.local
  const fromCol = FROM_COLOR[category] ?? FROM_COLOR.local

  const wrapperBase =
    'relative rounded-card bg-surface shadow-card dark:bg-surface-dark dark:border dark:border-line-dark dark:shadow-none'

  const content = (
    <div className="flex items-center gap-[14px] px-[18px] pt-[14px] pb-4">
      {/* chip */}
      <span
        data-route-chip
        className={`shrink-0 h-8 min-w-[60px] px-2.5 inline-flex items-center justify-center rounded-[9px] text-white text-[13px] font-extrabold tracking-[-.01em] tabular-nums shadow-[inset_0_-2px_0_rgba(0,0,0,.08)] ${chipBg}`}
      >
        {first.route_no}
      </span>

      {/* body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 leading-none mb-0.5">
          <span className={`text-[12px] font-extrabold tracking-[-.005em] ${muted ? 'text-mute-2 dark:text-mute-2-dark' : fromCol}`}>
            {origin}
          </span>
          <span className="text-[9.5px] font-bold uppercase tracking-[.04em] text-mute dark:text-mute-dark">
            에서 출발
          </span>
        </div>

        <div className="flex items-center gap-2 leading-tight">
          <span className={`truncate text-[15px] font-extrabold tracking-[-.01em] ${muted ? 'text-mute-2 dark:text-mute-2-dark' : 'text-ink dark:text-ink-dark'}`}>
            {headLabel}
          </span>
          {!isTimetable && crowdedLevel > 0 && <CrowdedBadge level={crowdedLevel} />}
          {isTimetable && (
            <span className="text-[10px] font-bold uppercase tracking-[.06em] text-mute dark:text-mute-dark">
              {first.depart_at ?? ''}
            </span>
          )}
        </div>

        <MiniTrack
          origin={origin}
          waypoints={waypoints}
          terminus={terminus}
          category={category}
          muted={muted}
        />
      </div>

      {/* eta */}
      <span
        data-eta
        className={`text-right shrink-0 leading-none tabular-nums ${imminent ? 'imminent' : ''}`}
      >
        <span className="inline-flex items-baseline">
          <span
            className={`font-black tracking-[-.05em] ${
              imminent
                ? 'text-imminent dark:text-imminent-dark text-[30px]'
                : muted
                ? 'text-mute-2 dark:text-mute-2-dark font-extrabold text-[24px]'
                : 'text-ink dark:text-ink-dark text-[30px]'
            }`}
          >
            {imminent ? (
              <span className="relative inline-block">
                {etaValue}
                <span aria-hidden className="absolute -inset-2 rounded-[14px] pointer-events-none animate-halo-pulse dark:animate-halo-pulse-dark" />
              </span>
            ) : (
              etaValue
            )}
          </span>
          {typeof etaValue === 'number' && (
            <span className={`ml-[2px] text-[11px] font-extrabold ${imminent ? 'text-imminent dark:text-imminent-dark opacity-70' : 'text-mute dark:text-mute-dark'}`}>분</span>
          )}
        </span>
        {etaSub && !muted && (
          <span className="block mt-[5px] text-[10px] font-semibold text-mute dark:text-mute-dark tracking-[-.005em]">
            {etaSub}
          </span>
        )}
      </span>
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

  return (
    <div data-route={first.route_no} className="relative">
      <button
        className={`w-full text-left pressable ${wrapperBase}`}
        onClick={() => onTimetableClick && onTimetableClick(first.route_id, first.route_no, path ? `${origin} → ${terminus}` : (first.destination ?? ''))}
      >
        {content}
      </button>
      {starButton}
    </div>
  )
}
