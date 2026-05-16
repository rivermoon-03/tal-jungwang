// realtime arrive_in_seconds → 분 단위 ceil.
// IMMINENT(<60s) 분기는 호출 측이 별도 처리하므로 여기는 ≥60s 가정.
// 음수·null은 0 반환.
//
// ceil 정책: backend apply_safety_margin이 raw에서 미리 깎아 보수적인 값을 보내므로
// 표시 단계에서는 ceil이 자연스럽다. BusEtaCard(모달)의 formatEta(ceil)와 통일해
// 카드/모달 ETA가 어긋나지 않게 한다.
export function realtimeSecToMinutes(sec) {
  if (sec == null || sec <= 0) return 0
  return Math.ceil(sec / 60)
}
