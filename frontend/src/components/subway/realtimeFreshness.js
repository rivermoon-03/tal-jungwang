/**
 * 지하철 실시간 데이터의 신선도 판정.
 *
 * 보드(SubwayRealtimeBoard)와 상세 시트가 같은 기준을 쓰도록 한곳에 둔다.
 * 컴포넌트 파일에서 분리해야 fast refresh가 동작한다.
 */

// stale 판정 임계(ms). 이 값을 다시 숫자로 적지 말고 항상 이 상수 또는
// isRealtimeStale()을 통해서만 참조한다 — SubwayRealtimeCard/SubwayRealtimeBoard가
// 한때 "3분"을 각자 리터럴로 다시 적어 임계가 어긋날 여지가 있었다.
export const STALE_THRESHOLD_MS = 180_000

/**
 * recptn_dt(실시간 API 생성 시각) 또는 last_successful_realtime_at 기준 age(초).
 * 3분(180s) 이상이면 stale로 간주한다.
 *
 * @param {string|null} reference  ISO8601 시각
 * @param {number} [now]  기준 시각(ms). 렌더 중 Date.now()를 직접 부르면 순수하지
 *   않고 tick 없이는 갱신도 안 되므로, 호출부가 useNow() 등으로 얻은 tick 값을
 *   넘길 수 있게 한다. 생략하면 Date.now().
 */
export function isRealtimeStale(reference, now = Date.now()) {
  if (!reference) return false
  const ms = new Date(reference).getTime()
  if (Number.isNaN(ms)) return false
  return (now - ms) >= STALE_THRESHOLD_MS
}

/**
 * 마지막 성공 응답이 1분 이내이고 stale 플래그가 없으면 "신선"으로 본다.
 * 상세 시트가 실시간 배지를 켤지 판단할 때 쓴다.
 */
export function isRealtimeFresh(lastSuccessfulRealtimeAt, stale) {
  if (stale) return false
  if (!lastSuccessfulRealtimeAt) return false
  const ts = new Date(lastSuccessfulRealtimeAt).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < 60_000
}
