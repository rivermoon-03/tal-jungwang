/**
 * etaAccuracy — 예측 오차 집계(bus_eta_accuracy)를 사용자가 행동할 수 있는 한 줄로 옮긴다.
 *
 * 왜 적중률을 앞세우지 않는가.
 * 2026-09-09 프로덕션 실측에서 ±1분 적중률은 14개 조합 중 최고가 76%였고 중앙값이
 * 40% 언저리였다. 기존 화면은 80% 이상을 "좋음" 으로 두어 실제로는 <b>모든 노선</b>이
 * "예측 편차가 큰 노선이에요" 를 달고 있었다. 전부에게 같은 경고를 띄우는 지표는
 * 정보가 아니다.
 *
 * 그리고 적중률의 지배 변수는 노선이 아니라 예측 리드타임이었다.
 *   2분 이내 예측 ±1분 적중 80% · 2~5분 59% · 5~10분 44% · 10분 초과 29%
 * 먼 예측이 부정확한 것은 노선 탓이 아니라 예측의 성질이다. 그걸 노선 평가로
 * 바꿔 말하면 거짓말이 된다.
 *
 * 그래서 이 모듈은 두 가지만 말한다.
 *   1. 편향 — 이 노선이 예보보다 꾸준히 늦게 오는가 일찍 오는가. 행동이 바뀐다.
 *   2. 분산 — 편향이 없는데도 들쭉날쭉한가. 여유를 두라고 말할 근거다.
 * 둘 다 해당 없으면 아무 말도 하지 않는다. 조용한 것이 기본값이다.
 */

// 이보다 작은 편향은 말하지 않는다. 30초는 화면의 분 단위 표시 안에서
// 사용자가 체감할 수 없는 크기다.
export const BIAS_MIN_SEC = 30

// 편향이 없어도 이만큼 흩어져 있으면 여유를 두라고 말한다.
// 실측 MAE 는 46~134초 범위였고, 120초는 그 상위 절반에 해당한다.
export const SPREAD_MIN_SEC = 120

/** 초를 "N분 M초" 로. 60초 미만은 초만, 분 단위로 떨어지면 분만 말한다. */
export function formatOffset(seconds) {
  const s = Math.abs(Math.round(seconds))
  if (s < 60) return `${s}초`
  const min = Math.floor(s / 60)
  const rest = s % 60
  return rest === 0 ? `${min}분` : `${min}분 ${rest}초`
}

/**
 * @param {{sample_size:number, mae_sec:number, bias_sec:number, within60_ratio:number}|null} accuracy
 * @returns {{tone:'early'|'late'|'spread', text:string}|null} 말할 것이 없으면 null
 */
export function describeEtaAccuracy(accuracy) {
  if (!accuracy || typeof accuracy !== 'object') return null

  const bias = Number(accuracy.bias_sec)
  const mae = Number(accuracy.mae_sec)
  if (!Number.isFinite(bias) || !Number.isFinite(mae)) return null

  // bias_sec 양수 = 예측보다 늦게 도착(models/bus.py BusEtaSample 참고).
  if (bias >= BIAS_MIN_SEC) {
    return { tone: 'late', text: `예보보다 평균 ${formatOffset(bias)} 늦게 와요 · 여유 있게` }
  }
  if (bias <= -BIAS_MIN_SEC) {
    return { tone: 'early', text: `예보보다 평균 ${formatOffset(bias)} 일찍 와요 · 조금 일찍 나가세요` }
  }
  if (mae >= SPREAD_MIN_SEC) {
    return { tone: 'spread', text: `도착 시각이 들쭉날쭉해요 · 평균 ${formatOffset(mae)} 차이` }
  }
  return null
}

/**
 * 예측 리드타임이 길수록 오차가 커진다. 지금 화면에 뜬 예측이 얼마나 먼지에 따라
 * 신뢰 문구를 붙일지 정한다 — 2분 뒤 도착에 "여유 있게" 는 할 수 있는 게 없다.
 */
export const ACCURACY_MIN_LEAD_SEC = 120

export function shouldShowAccuracy(accuracy, arriveInSeconds) {
  if (arriveInSeconds != null && arriveInSeconds < ACCURACY_MIN_LEAD_SEC) return false
  return describeEtaAccuracy(accuracy) != null
}
