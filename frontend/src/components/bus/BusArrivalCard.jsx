import { Fragment, memo } from 'react'
import { Star } from 'lucide-react'
import {
  getRouteDisplayConfig,
  getRouteCategory,
  getRoutePath,
  ROUTE_WAYPOINTS,
} from '../dashboard/busStationConfig'
import useFavorites from '../../hooks/useFavorites'
import { IMMINENT_THRESHOLD_SEC } from '../../utils/arrivalTime'
import { formatEta } from '../../utils/eta'
import RouteBadge from '../ui/RouteBadge'
import StatusChip from '../ui/StatusChip'
import MiniTrack from './MiniTrack'
import { staggerStyle } from '../../utils/motion'

// ─────────────────────────────────────────────────────────────────────────────
// CrowdedBadge / RouteProgressStrip — 외부 호환을 위해 유지
// ─────────────────────────────────────────────────────────────────────────────

const CROWDED_META = {
  1: { label: '여유', kind: 'ease' },
  2: { label: '보통', kind: 'last' },
  3: { label: '혼잡', kind: 'crowded' },
  4: { label: '매우혼잡', kind: 'crowded' },
}

export function CrowdedBadge({ level }) {
  const meta = CROWDED_META[level]
  if (!meta) return null
  return <StatusChip kind={meta.kind}>{meta.label}</StatusChip>
}

// 노선 경유 진행 표시 바 — 기존 사용처(BusTimetableDetail, ScheduleDetailModal 등) 호환 유지
export function RouteProgressStrip({ routeNo, stationId, hasArrival }) {
  const waypoints = ROUTE_WAYPOINTS[routeNo]
  if (!waypoints) return null

  const activeSegIdx = hasArrival ? waypoints.findIndex((w) => w.id === stationId) : -1

  return (
    <div className="px-4 pb-3">
      <div className="flex items-start">
        <div className="mt-[6px] w-3 shrink-0 h-px bg-line dark:bg-line" />
        {waypoints.map((wp, i) => (
          <Fragment key={wp.id}>
            <div className="relative flex-1 flex items-center mt-[6px]">
              <div className={`w-full h-px ${activeSegIdx === i ? 'bg-accent' : 'bg-line dark:bg-line'}`} />
              {activeSegIdx === i && (
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent shadow" />
              )}
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-3 h-3 rounded-full border-2 ${wp.id === stationId ? 'border-accent bg-surface dark:bg-surface' : 'border-line-strong dark:border-line-strong bg-surface dark:bg-bg'}`} />
              <span className={`text-[12px] mt-0.5 whitespace-nowrap leading-tight ${wp.id === stationId ? 'font-bold text-accent' : 'text-mute dark:text-mute'}`}>
                {wp.label}
              </span>
            </div>
          </Fragment>
        ))}
        <div className="flex-1 mt-[6px] h-px bg-line dark:bg-line" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// head label 정규화 — "방면"은 "행"으로, 이미 "행"으로 끝나면 중복 추가 금지.
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

// formatEta 임박 임계값 — eta.js와 동일하게 90초
const ETA_IMMINENT_SEC = 90

function computeDisplay(arrivals) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const valid = arrivals.filter((a) =>
    isTimetable
      ? a.depart_at != null
      : a.arrive_in_seconds != null && a.arrive_in_seconds > 0
  )
  const shown = valid.slice(0, 2)
  if (shown.length === 0) {
    return { etaText: '—', etaSub: null, imminent: false, stats: null }
  }

  if (isTimetable) {
    const a0 = shown[0]
    if (a0.is_tomorrow) {
      return { etaText: '내일', etaSub: a0.depart_at, imminent: false, stats: null }
    }
    const sec = secondsUntil(a0.depart_at)
    if (sec <= ETA_IMMINENT_SEC) {
      return { etaText: '곧', etaSub: a0.depart_at, imminent: true, stats: null }
    }
    // formatEta floor 정책
    const min = Math.floor(sec / 60)
    const sub = shown[1]?.depart_at ? `다음 ${shown[1].depart_at}` : a0.depart_at
    return { etaText: String(min), etaSub: sub, imminent: false, stats: null, isMinutes: true }
  }

  const stats = arrivals[0]?.stats ?? null
  const sec0 = shown[0].arrive_in_seconds ?? 0

  if (sec0 <= ETA_IMMINENT_SEC) {
    return { etaText: '곧', etaSub: `${Math.max(0, sec0)}초 후`, imminent: true, stats }
  }

  // formatEta floor 정책
  const min0 = Math.floor(sec0 / 60)

  // sub 표시: 다음 버스 절대시각 > stats > 없음
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

  return { etaText: String(min0), etaSub: sub, imminent: false, stats, isMinutes: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────────────────────────────────────

function BusArrivalCard({ arrivals, stationId, onTimetableClick, selectedStation = null, index = null }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const cfg = getRouteDisplayConfig(first.route_no)
  const category = cfg?.category ?? getRouteCategory(first.route_no)
  const path = getRoutePath(first.route_no, first.category) ?? null

  const origin = path?.origin ?? first.origin ?? ''
  const waypoints = path?.waypoints ?? []
  const terminus = path?.terminus ?? first.destination ?? ''
  const headLabel = toHeadLabel(path?.label ?? first.destination ?? '')

  const { etaText, etaSub, imminent, isMinutes } = computeDisplay(arrivals)
  const crowdedLevel = !isTimetable ? arrivals[0]?.crowded : 0

  const favKey = first.route_no
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)

  const muted = etaText === '—'

  const wrapperBase =
    'relative rounded-card bg-surface shadow-card dark:bg-surface dark:border dark:border-line dark:shadow-none'

  const content = (
    <div className="flex items-center gap-[14px] px-[18px] py-4">
      {/* 노선 뱃지 */}
      <RouteBadge route={first.route_no} className="shrink-0" />

      {/* 본문 (시안 C: 출발·경유 텍스트는 아래 트랙과 중복이라 생략) */}
      <div className="flex-1 min-w-0">
        {/* 행선지 + 상태 */}
        <div className="flex items-center gap-2 leading-tight">
          <span className={`truncate text-head font-semibold tracking-[-.01em] ${muted ? 'text-mute' : 'text-ink'}`}>
            {headLabel}
          </span>
          {!isTimetable && crowdedLevel > 0 && <CrowdedBadge level={crowdedLevel} />}
          {!isTimetable && !muted && (
            <StatusChip kind="realtime">실시간</StatusChip>
          )}
          {isTimetable && first.depart_at && (
            <span className="text-label font-bold text-mute">
              {first.depart_at}
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

      {/* ETA (우측) — "N분 후" */}
      <span
        data-eta
        className={`text-right shrink-0 leading-none tabular-nums ${imminent ? 'imminent' : ''}`}
      >
        <span className="inline-flex items-baseline">
          <span
            key={etaText}
            className={`tj-number-pulse font-bold tracking-[-.05em] ${
              imminent
                ? 'text-imminent dark:text-imminent text-[30px]'
                : muted
                ? 'text-mute font-semibold text-[24px]'
                : 'text-ink dark:text-ink text-[30px]'
            }`}
          >
            {imminent ? (
              <span className="relative inline-block">
                {etaText}
                <span aria-hidden className="absolute -inset-2 rounded-card pointer-events-none animate-halo-pulse dark:animate-halo-pulse-dark" />
              </span>
            ) : (
              etaText
            )}
          </span>
          {isMinutes && !imminent && (
            <span className="ml-[2px] text-body font-semibold text-mute">분 후</span>
          )}
        </span>
        {etaSub && !muted && (
          <span className="block mt-[5px] text-caption font-semibold text-mute tracking-[-.005em]">
            {etaSub}
          </span>
        )}
      </span>

      {/* 즐겨찾기 — 원형 테두리 버튼, 카드 세로 중앙, 모바일에서 누르기 쉽게 크게(40px) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggleFav({ type: 'bus', label: first.route_no }) }}
        aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        className={`shrink-0 self-center flex items-center justify-center w-10 h-10 rounded-full border pressable ${
          isFavorite
            ? 'border-imminent/40 bg-imminent/10'
            : 'border-line dark:border-line bg-surface dark:bg-surface'
        }`}
      >
        <Star
          size={19}
          fill={isFavorite ? 'currentColor' : 'none'}
          className={isFavorite ? 'text-imminent' : 'text-mute'}
        />
      </button>
    </div>
  )

  function handleCardClick() {
    // /route/bus:{routeNumber}?stop={station} 으로 네비게이트 (history.pushState + popstate 기반)
    const routeId = `bus:${first.route_no}`
    const stopQuery = selectedStation
      ? `?stop=${encodeURIComponent(selectedStation)}`
      : ''
    const url = `/route/${routeId}${stopQuery}`
    window.history.pushState({ routeId }, '', url)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
    // 기존 onTimetableClick 계약도 유지 (외부 사용처 호환)
    if (onTimetableClick) {
      onTimetableClick(
        first.route_id,
        first.route_no,
        path ? `${origin} → ${terminus}` : (first.destination ?? '')
      )
    }
  }

  return (
    <div
      data-route={first.route_no}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick() }
      }}
      className={`w-full text-left cursor-pointer pressable ${wrapperBase} ${index != null ? 'tj-card-enter' : ''}`}
      style={index != null ? staggerStyle(index) : undefined}
    >
      {content}
    </div>
  )
}

export default memo(BusArrivalCard)
