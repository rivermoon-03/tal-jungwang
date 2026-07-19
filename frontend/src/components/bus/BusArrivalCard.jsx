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
import DataBadge from '../ui/DataBadge'
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

  // 시안 B — 좌측 ETA 컬럼형. ETA를 왼쪽 세로 컬럼으로 빼 제목/트랙이 풀폭을
  // 확보(폰에서 제목이 "구로…"로 잘리거나 트랙이 3줄로 wrap되던 문제 해소).
  const content = (
    <div className="flex items-stretch gap-3 px-[16px] py-4">
      {/* 좌: ETA 컬럼 (큰 숫자 + "분 후") + 다음 차 시각 */}
      <div
        data-eta
        className={`shrink-0 w-[58px] flex flex-col items-center justify-center border-r border-line dark:border-line pr-3 tabular-nums ${imminent ? 'imminent' : ''}`}
      >
        <span className="inline-flex items-baseline leading-none">
          <span
            key={etaText}
            className={`tj-number-pulse font-bold tracking-[-.05em] ${
              imminent
                ? 'text-imminent dark:text-imminent text-[26px]'
                : muted
                ? 'text-mute font-semibold text-[22px]'
                : 'text-ink dark:text-ink text-[26px]'
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
        </span>
        {isMinutes && !imminent && (
          <span className="text-caption font-semibold text-mute mt-0.5">분 후</span>
        )}
        {etaSub && !muted && (
          <span className="block mt-1 text-micro font-semibold text-mute text-center leading-tight">
            {etaSub}
          </span>
        )}
      </div>

      {/* 우: 정보 (풀폭) — [badge · 행선지 · 상태 · 별] / 트랙 */}
      <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
        <div className="flex items-center gap-2 leading-tight">
          <RouteBadge route={first.route_no} className="shrink-0" />
          <span className={`truncate text-head font-semibold tracking-[-.01em] min-w-0 ${muted ? 'text-mute' : 'text-ink'}`}>
            {headLabel}
          </span>
          {isTimetable && first.depart_at && (
            <span className="shrink-0 text-label font-bold text-mute">
              {first.depart_at}
            </span>
          )}
          {!isTimetable && crowdedLevel > 0 && <CrowdedBadge level={crowdedLevel} />}
          {!isTimetable && !muted && <DataBadge state="live" />}
          {/* 즐겨찾기 — 원형 테두리 버튼, 제목 행 우측. 44px 탭영역(내부 패딩). */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFav({ type: 'bus', label: first.route_no }) }}
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            className={`ml-auto shrink-0 flex items-center justify-center w-9 h-9 rounded-full border pressable ${
              isFavorite
                ? 'border-imminent/40 bg-imminent/10'
                : 'border-line dark:border-line bg-surface dark:bg-surface'
            }`}
          >
            <Star
              size={18}
              fill={isFavorite ? 'currentColor' : 'none'}
              className={isFavorite ? 'text-imminent' : 'text-mute'}
            />
          </button>
        </div>

        <MiniTrack
          origin={origin}
          waypoints={waypoints}
          terminus={terminus}
          category={category}
          muted={muted}
        />
      </div>
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
