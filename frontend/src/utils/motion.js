/**
 * motion.js — 리스트 스태거(60ms 간격) 등 모션 표시 로직 헬퍼(DESIGN.md §4).
 * 인라인으로 `idx * 60 + 'ms'`를 각 컴포넌트마다 복붙하지 않고 여기서 일원화한다.
 */

const STEP_MS = 60
const MAX_STEPS = 8 // 대량 리스트에서 마지막 카드까지 과하게 늦게 나타나지 않도록 상한

/**
 * 리스트 항목 진입 애니메이션의 animation-delay 값을 계산한다.
 * @param {number} index 리스트 내 항목 순서(0-base)
 * @param {number} stepMs 항목 간 딜레이 간격(기본 60ms, DESIGN.md §4)
 * @returns {string} CSS animation-delay 문자열, 예: "120ms"
 */
export function staggerDelay(index, stepMs = STEP_MS) {
  const capped = Math.min(index, MAX_STEPS)
  return `${capped * stepMs}ms`
}

/**
 * tj-card-enter 클래스와 함께 쓰는 style 객체.
 * @param {number} index
 */
export function staggerStyle(index) {
  return { animationDelay: staggerDelay(index) }
}
