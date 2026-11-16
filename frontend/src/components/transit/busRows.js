import { clockToMinutes, minutesLabel, stopsLabel, isSoon, ARRIVING_LABEL } from './format'

/**
 * 도착 응답 → 전광판 행. 노선마다 이번 차와 다음 차를 묶고 도착순으로 정렬한다.
 * nowMin 은 시간표 기반 출발 시각을 남은 초로 바꿀 때 쓴다.
 */
export function buildBusRows(arrivals, routeDisplay, nowMin) {
  const byRoute = new Map()
  for (const a of arrivals ?? []) {
    const list = byRoute.get(a.route_no) ?? []
    byRoute.set(a.route_no, [...list, a])
  }
  const rows = [...byRoute.entries()].map(([route, list]) => {
    const withSec = list.map((a) => ({ ...a, sec: secondsOf(a, nowMin) }))
    const sorted = [...withSec].sort((x, y) => (x.sec ?? Infinity) - (y.sec ?? Infinity))
    const [cur, next] = sorted
    const disp = routeDisplay?.[route]
    return {
      route,
      dest: disp?.dest ?? cur.destination ?? '',
      realtime: cur.arrival_type === 'realtime',
      offService: cur.off_service,
      firstAt: cur.next_first_at,
      sec: cur.sec,
      main: mainLabel(cur),
      position: positionLabel(cur),
      soon: cur.arrival_type === 'realtime' && isSoon(cur.sec),
      nextLabel: next?.sec != null ? `다음 ${minutesLabel(next.sec)}` : null,
      seats: cur.remain_seat >= 0 ? `좌석 ${cur.remain_seat}` : null,
    }
  })
  return rows.sort((a, b) => Number(a.offService) - Number(b.offService) || (a.sec ?? Infinity) - (b.sec ?? Infinity))
}

function secondsOf(a, nowMin) {
  if (a.off_service) return null
  if (a.arrival_type === 'realtime') return a.arrive_in_seconds ?? null
  const m = clockToMinutes(a.depart_at)
  if (m == null) return null
  const diff = a.is_tomorrow ? m + 1440 - nowMin : m - nowMin
  return diff >= 0 ? diff * 60 : null
}

function mainLabel(a) {
  if (a.off_service) return '운행 종료'
  if (a.arrival_type === 'realtime') return minutesLabel(a.arrive_in_seconds)
  return a.depart_at ?? '정보 없음'
}

function positionLabel(a) {
  if (a.off_service) return a.next_first_at ? `첫차 ${a.next_first_at}` : null
  if (a.arrival_type !== 'realtime') return '시간표 기준'
  return stopsLabel(a.location_no) ?? ARRIVING_LABEL
}

/** 행선지 문구 → 짧은 행선지("사당 경유 강남행" → "강남행", "정왕역 경유" → "정왕역행") */
export function destKey(dest) {
  if (!dest) return null
  const words = dest.replace(/\s*방면$/, '').trim().split(/\s+/)
  const last = words[words.length - 1] === '경유' ? words[words.length - 2] : words[words.length - 1]
  if (!last) return null
  return last.endsWith('행') ? last : `${last}행`
}

/** 정류장의 행선지 목록(설정 순서 유지, 중복 제거) */
export function destKeysOf(routeDisplay) {
  return [...new Set(Object.values(routeDisplay ?? {}).map((d) => destKey(d.dest)).filter(Boolean))]
}
