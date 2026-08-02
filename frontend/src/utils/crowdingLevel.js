/**
 * crowdingLevel.js — 혼잡도 라벨의 단일 출처.
 *
 * 라벨 규칙이 crowdingPalette.crowdedLabel, BusPanel.CROWDED_META,
 * ArrivalRow.CROWDED_KIND 세 곳에 흩어져 있었고, 그 결과 등급 4가 한 화면에선
 * "혼잡", 다른 화면에선 "매우혼잡"으로 보였다. 여기 하나로 모은다.
 *
 * 축이 둘이라는 점이 중요하다.
 *
 * - **비율**(과거 통계): 이 시간대 도착 버스 중 혼잡(등급 3 이상) 비율.
 *   평균을 쓰지 않는 이유는 하한이 1이라서다 — 값 1인 버스와 3인 버스가 반씩이면
 *   평균 2("보통")가 나오는데, 그 2는 실제로 존재한 어떤 버스도 설명하지 못한다.
 *   시흥33 하교 17시가 실측 ≥3 비율 46.6%인데 화면에서 "보통"이던 원인이다.
 * - **등급**(실시간): 지금 오는 버스 한 대의 관측값. 평균 문제가 없으므로 1~4를
 *   그대로 옮긴다.
 *
 * 설계: docs/superpowers/specs/2026-08-02-bus-crowding-thresholds-design.md §3, §4
 */

/** 혼잡 비율 → 라벨 경계. 프로덕션 실측(2026-08-02)에 맞춰 정한 값이다. */
export const RATIO_THRESHOLDS = {
  normal: 0.05,
  busy: 0.15,
  veryBusy: 0.35,
}

const LEVEL_LABELS = {
  1: '여유',
  2: '보통',
  3: '혼잡',
  4: '매우혼잡',
}

// 보정(bus_crowding_calibrations)이 값을 올린 경우 붙는 꼬리표. 사람이 넣은 단언을
// 센서 관측인 척 보여주지 않기 위한 표기다.
const ESTIMATED_SUFFIX = ' · 경험 기준'

function withSource(label, estimated) {
  return estimated ? `${label}${ESTIMATED_SUFFIX}` : label
}

/**
 * 혼잡 비율(0~1) → 라벨.
 *
 * @param {number|null|undefined} ratio
 * @param {{estimated?: boolean, reliable?: boolean}} [opts]
 *   reliable=false면 표본이 적어 비율의 분산이 크다는 뜻이므로 등급을 단정하지 않는다.
 */
export function labelFromRatio(ratio, { estimated = false, reliable = true } = {}) {
  if (ratio == null || Number.isNaN(ratio)) return '정보 없음'
  if (!reliable) return '정보 부족'

  let label
  if (ratio < RATIO_THRESHOLDS.normal) label = '여유'
  else if (ratio < RATIO_THRESHOLDS.busy) label = '보통'
  else if (ratio < RATIO_THRESHOLDS.veryBusy) label = '붐빔'
  else label = '매우 붐빔'

  return withSource(label, estimated)
}

/**
 * 실시간 등급(1~4) → 라벨. 0이나 범위 밖이면 null — 칩을 그리지 않는다는 신호다.
 *
 * @param {number|null|undefined} level
 * @param {{estimated?: boolean}} [opts]
 */
export function labelFromLevel(level, { estimated = false } = {}) {
  const label = LEVEL_LABELS[level]
  if (!label) return null
  return withSource(label, estimated)
}

/** 칩 색 톤. 붐빔 이상만 경고색을 쓴다(대면적 경고색 남용 방지). */
export function toneFromLevel(level) {
  return level >= 3 ? 'warn' : 'neutral'
}

export function toneFromRatio(ratio) {
  if (ratio == null || Number.isNaN(ratio)) return 'neutral'
  return ratio >= RATIO_THRESHOLDS.busy ? 'warn' : 'neutral'
}
