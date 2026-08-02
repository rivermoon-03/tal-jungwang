/**
 * F6 만차·결행 제보 훅/헬퍼.
 *
 * - useActiveBusReports(stationKey): 정류장의 활성(30분 창) 신호 목록.
 *   도착 카드 경고 뱃지용 — 60초 폴링(신호 TTL 30분 대비 충분).
 * - submitBusSignal(kind, routeNo, stationKey): 신호 제보 POST.
 *   기기당 (노선, 종류) 10분 1회 로컬 스로틀 — 서버 rate limit(3/min)과 이중.
 */
import { useApi, apiFetch } from './useApi'

const THROTTLE_MS = 10 * 60 * 1000

const SIGNAL_LABELS = {
  bus_full: '만차로 지나갔어요',
  bus_no_show: '시간 지나도 안 와요',
}

function throttleKey(routeNo, kind) {
  return `busSignal:${routeNo}:${kind}`
}

export function canSubmitBusSignal(routeNo, kind, now = Date.now()) {
  try {
    const last = Number(localStorage.getItem(throttleKey(routeNo, kind)) || 0)
    return now - last >= THROTTLE_MS
  } catch {
    return true
  }
}

export function markBusSignalSubmitted(routeNo, kind, now = Date.now()) {
  try {
    localStorage.setItem(throttleKey(routeNo, kind), String(now))
  } catch {
    /* localStorage 불가 환경 — 서버 rate limit만으로 완충 */
  }
}

export async function submitBusSignal(kind, routeNo, stationKey) {
  await apiFetch('/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: kind,
      message: `${SIGNAL_LABELS[kind] ?? kind} · ${routeNo}`,
      route_no: routeNo,
      station_key: String(stationKey),
    }),
  })
  markBusSignalSubmitted(routeNo, kind)
}

export function useActiveBusReports(stationKey) {
  return useApi(
    stationKey ? `/report/active?station_key=${stationKey}` : '/report/active',
    { interval: 60_000, enabled: !!stationKey }
  )
}

// 카드 뱃지 라벨 — "만차 제보 2건 · 10분 전"
export function busReportChipLabel(item) {
  const noun = item.kind === 'bus_no_show' ? '결행' : '만차'
  const ago = item.minutes_ago <= 0 ? '방금' : `${item.minutes_ago}분 전`
  return `${noun} 제보 ${item.count}건 · ${ago}`
}
