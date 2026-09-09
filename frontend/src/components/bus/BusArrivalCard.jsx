import { memo } from 'react'
import { Star } from 'lucide-react'
import {
  getRouteDisplayConfig,
  getRouteCategory,
  getRoutePath,
} from '../dashboard/busStationConfig'
import useFavorites from '../../hooks/useFavorites'
import TransitCard from '../ui/TransitCard'
import IconButton from '../ui/IconButton'
import MiniTrack from './MiniTrack'
import { labelFromLevel } from '../../utils/crowdingLevel'
import { formatEta, formatHHMM, isImminent } from '../../utils/eta'
import { staggerStyle } from '../../utils/motion'

// head label 정규화 — "방면"은 "행"으로, 이미 "행"으로 끝나면 중복 추가 금지.
function toHeadLabel(label) {
  if (!label) return ''
  if (/방면/.test(label)) return label.replace(/\s*방면/g, '행')
  return label.endsWith('행') ? label : `${label}행`
}

function secondsUntil(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0)
  return Math.floor((target - now) / 1000)
}

/**
 * 도착 배열 → TransitCard 의 eta 프롭.
 *
 * 문구와 임박 임계는 utils/eta.js 하나에서 온다 — 예전엔 이 파일이 90초를
 * 로컬 상수로 복제해 들고 있었다.
 */
function computeEta(arrivals) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const valid = arrivals.filter((a) =>
    isTimetable
      ? a.depart_at != null
      : a.arrive_in_seconds != null && a.arrive_in_seconds > 0
  )
  const shown = valid.slice(0, 2)
  if (shown.length === 0) {
    return { eta: { primary: { text: '운행 정보 없음', tone: 'muted' } }, muted: true }
  }

  if (isTimetable) {
    const a0 = shown[0]
    if (a0.is_tomorrow) {
      return {
        eta: { primary: { text: '내일', tone: 'muted' }, secondary: { text: a0.depart_at } },
        muted: false,
      }
    }
    const sec = secondsUntil(a0.depart_at)
    const { text, tone } = formatEta(sec)
    const next = shown[1]?.depart_at ? `다음 ${shown[1].depart_at}` : a0.depart_at
    return {
      eta: {
        primary: { text, tone: tone === 'imminent' ? 'imminent' : 'default' },
        secondary: { text: next },
      },
      muted: false,
    }
  }

  const sec0 = shown[0].arrive_in_seconds ?? 0
  const { text, tone } = formatEta(sec0)

  // 보조 줄: 다음 차 절대시각 > 통계 편차 > 없음
  const sec1 = shown[1]?.arrive_in_seconds
  const stats = arrivals[0]?.stats ?? null
  const sub =
    sec1 != null
      ? `다음 ${formatHHMM(Date.now() + sec1 * 1000)}`
      : stats?.tolerance_min != null
        ? `보통 ±${stats.tolerance_min}분`
        : null

  return {
    eta: {
      primary: { text, tone: tone === 'imminent' ? 'imminent' : 'default' },
      secondary: sub ? { text: sub } : undefined,
    },
    muted: false,
    imminent: isImminent(sec0),
  }
}

/**
 * BusArrivalCard — 정류장 도착 목록의 한 노선.
 *
 * 해부도는 정본 TransitCard 를 그대로 쓴다. 이 파일이 하는 일은 GBIS 응답을
 * 카드 프롭으로 옮기고, 노선 경로 트랙과 즐겨찾기 별을 끼워 넣는 것뿐이다.
 */
function BusArrivalCard({ arrivals, onTimetableClick, selectedStation = null, index = null }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const cfg = getRouteDisplayConfig(first.route_no)
  const category = cfg?.category ?? getRouteCategory(first.route_no)
  const path = getRoutePath(first.route_no, first.category) ?? null

  const origin = path?.origin ?? first.origin ?? ''
  const waypoints = path?.waypoints ?? []
  const terminus = path?.terminus ?? first.destination ?? ''
  const headLabel = toHeadLabel(path?.label ?? first.destination ?? '')

  const { eta, muted } = computeEta(arrivals)
  const crowdedLevel = !isTimetable ? arrivals[0]?.crowded : 0
  const crowdedLabel = crowdedLevel > 0 ? labelFromLevel(crowdedLevel) : null

  const { isFavorite, toggle: toggleFav } = useFavorites(first.route_no)

  // 칩 순서는 TransitCard 규격을 따른다 — 실시간 → 혼잡 → 나머지.
  const chips = []
  if (!isTimetable && !muted) chips.push({ label: '실시간', tone: 'realtime' })
  if (crowdedLabel) chips.push({ label: crowdedLabel, tone: crowdedLevel >= 3 ? 'warn' : 'neutral' })
  if (isTimetable && first.depart_at) chips.push({ label: first.depart_at, tone: 'neutral' })

  function handleCardClick() {
    // /route/bus:{routeNumber}?stop={station} 으로 이동(history.pushState + popstate).
    const routeId = `bus:${first.route_no}`
    const stopQuery = selectedStation ? `?stop=${encodeURIComponent(selectedStation)}` : ''
    window.history.pushState({ routeId }, '', `/route/${routeId}${stopQuery}`)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
    // 기존 onTimetableClick 계약도 유지(외부 사용처 호환).
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
      className={index != null ? 'tj-card-enter' : undefined}
      style={index != null ? staggerStyle(index) : undefined}
    >
      <TransitCard
        badge={{ label: first.route_no, mode: 'bus' }}
        title={headLabel}
        chips={chips}
        eta={eta}
        muted={muted}
        onClick={handleCardClick}
        rightAddon={
          <IconButton
            onClick={(e) => { e.stopPropagation(); toggleFav({ type: 'bus', label: first.route_no }) }}
            label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            variant={isFavorite ? 'surface' : 'ghost'}
          >
            <Star
              size={18}
              fill={isFavorite ? 'currentColor' : 'none'}
              className={isFavorite ? 'text-imminent' : 'text-mute'}
            />
          </IconButton>
        }
        footer={
          <MiniTrack
            origin={origin}
            waypoints={waypoints}
            terminus={terminus}
            category={category}
            muted={muted}
          />
        }
      />
    </div>
  )
}

export default memo(BusArrivalCard)
