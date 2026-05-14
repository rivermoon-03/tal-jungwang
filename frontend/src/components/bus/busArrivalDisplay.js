// realtime arrive_in_seconds → 분 단위 floor.
// IMMINENT(<60s) 분기는 호출 측이 별도 처리하므로 여기는 ≥60s 가정.
// 음수·null은 0 반환.
export function realtimeSecToMinutes(sec) {
  if (sec == null || sec <= 0) return 0
  return Math.floor(sec / 60)
}
