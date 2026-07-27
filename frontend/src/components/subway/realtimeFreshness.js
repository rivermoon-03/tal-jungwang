/**
 * 지하철 실시간 데이터의 신선도 판정.
 *
 * 보드(SubwayRealtimeBoard)와 상세 시트가 같은 기준을 쓰도록 한곳에 둔다.
 * 컴포넌트 파일에서 분리해야 fast refresh가 동작한다.
 */

/**
 * recptn_dt(실시간 API 생성 시각) 또는 last_successful_realtime_at 기준 age(초).
 * 3분(180s) 이상이면 stale로 간주한다.
 */
export function isRealtimeStale(reference) {
  if (!reference) return false
  const ms = new Date(reference).getTime()
  if (Number.isNaN(ms)) return false
  return (Date.now() - ms) >= 180_000
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
