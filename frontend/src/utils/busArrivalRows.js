/**
 * busArrivalRows — GBIS 실시간 도착 배열을 노선별로 묶고, 화면 표시용 row로
 * 변환하는 순수 함수 모음.
 *
 * BusPanel(리스트 카드)과 useMapBottomCardData(PC 플로팅 하단 카드) 양쪽에서
 * 재사용한다. 반올림·포맷·정렬 로직을 이 파일 한 곳에만 두어 인라인 복붙으로
 * 인한 도착 시각 불일치 회귀를 막는다(mistakes.md 2).
 */
import { formatEta } from './eta'
import { IMMINENT_THRESHOLD_SEC } from './arrivalTime'
import {
  getPerRouteDisplay,
  getRouteDisplayConfig,
  getViaLabel,
  getOriginLabel,
} from '../components/dashboard/busStationConfig'

const DEFAULT_ROUTE_COLOR = '#64748B'

/**
 * route_no 기준으로 그룹핑 — 같은 노선의 여러 버스를 1행으로 표시.
 * 운행 정보가 있는 노선을 먼저, 없는 노선을 뒤로; 동일 그룹 내 도착이 임박한 순.
 */
export function groupArrivalsByRoute(arrivals) {
  const routeGroups = []
  const seenRoutes = new Map()
  for (const a of arrivals) {
    if (seenRoutes.has(a.route_no)) {
      seenRoutes.get(a.route_no).push(a)
    } else {
      const group = [a]
      seenRoutes.set(a.route_no, group)
      routeGroups.push(group)
    }
  }

  const groupHasLive = (g) =>
    g.some((a) => a.minutes != null || a.predict_sec != null || a.arrive_in_seconds != null)
  const groupEarliest = (g) => {
    let min = Infinity
    for (const a of g) {
      const m =
        a.minutes != null
          ? a.minutes
          : a.predict_sec != null
          ? Math.floor(a.predict_sec / 60)
          : a.arrive_in_seconds != null
          ? Math.floor(a.arrive_in_seconds / 60)
          : null
      if (m != null && m < min) min = m
    }
    return min === Infinity ? 9999 : min
  }
  routeGroups.sort((a, b) => {
    const aHas = groupHasLive(a)
    const bHas = groupHasLive(b)
    if (aHas !== bHas) return aHas ? -1 : 1
    return groupEarliest(a) - groupEarliest(b)
  })
  return routeGroups
}

/** 도착 엔트리(timetable | realtime) → 남은 초. */
export function arrivalEntryToSeconds(entry, now = new Date()) {
  if (!entry) return null
  if (entry.arrival_type === 'timetable') {
    if (!entry.is_tomorrow && entry.depart_at) {
      const [h, m] = entry.depart_at.split(':').map(Number)
      const t = new Date(now)
      t.setHours(h, m, 0, 0)
      const diffSec = Math.floor((t - now) / 1000)
      return diffSec < 0 ? null : diffSec
    }
    return null
  }
  return entry.arrive_in_seconds ?? null
}

export function arrivalSecondsToMinutes(sec) {
  return sec == null ? null : Math.max(0, Math.ceil(sec / 60))
}

/**
 * 도착 그룹(같은 노선의 여러 차) 하나를 표시용 row로 변환한다.
 *
 * @param {object[]} group - groupArrivalsByRoute가 반환한 그룹 중 하나
 * @param {{ station: string, direction: string, now?: Date }} ctx
 */
export function buildBusArrivalRow(group, { station, direction, now = new Date() } = {}) {
  const a = group[0]
  const a2 = group[1] ?? null

  const sec = arrivalEntryToSeconds(a, now)
  const sec2 = arrivalEntryToSeconds(a2, now)
  const minutes = arrivalSecondsToMinutes(sec)
  const minutes2 = arrivalSecondsToMinutes(sec2)
  const imminent = sec != null && sec < IMMINENT_THRESHOLD_SEC

  const perRoute = getPerRouteDisplay(station)?.[a.route_no]
  const cfg = getRouteDisplayConfig(a.route_no)
  const viaLabel = getViaLabel(station, direction)
  const destText = perRoute?.dest ?? cfg?.direction ?? viaLabel ?? (a.destination ?? '')
  const originText = perRoute ? getOriginLabel(station, direction, perRoute.origin) : ''
  const routeColor = cfg?.color ?? DEFAULT_ROUTE_COLOR

  const etaResult = a.is_tomorrow ? { text: '내일 첫차', tone: 'normal' } : formatEta(sec)

  return {
    routeNo: a.route_no,
    routeColor,
    direction: originText || destText,
    subdirection: originText && destText ? destText : '',
    minutes: a.is_tomorrow ? '내일 첫차' : minutes,
    minutes2,
    imminent,
    isRealtime: a.arrival_type === 'realtime',
    crowded: a.arrival_type === 'realtime' ? (a.crowded ?? 0) : 0,
    etaText: etaResult.text,
    etaTone: imminent ? 'imminent' : etaResult.tone,
  }
}
