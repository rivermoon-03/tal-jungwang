// realtime arrive_in_seconds → 분 단위(floor).
// IMMINENT 분기는 호출 측이 별도 처리하므로 여기는 그대로 초를 분으로만 바꾼다.
// 음수·null은 0 반환.
//
// 라운딩 정책: utils/eta.js가 "초 → 표시 문자열" 변환의 표준이고, 그쪽은 floor를
// 쓴다. 예전엔 이 함수가 ceil을 써 BusEtaCard의 로컬 ceil 로직과 맞췄지만,
// BusEtaCard도 이제 eta.js formatEta(floor)에 위임하므로 여기도 같은 규칙을 쓴다.
export function realtimeSecToMinutes(sec) {
  if (sec == null || sec <= 0) return 0
  return Math.floor(sec / 60)
}
