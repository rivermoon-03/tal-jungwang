/**
 * arrivalDistribution.js
 *
 * ArrivalDistributionBar의 위치 계산 순수 함수.
 * 별도 유틸 파일로 분리한 이유: ArrivalDistributionBar.jsx는 컴포넌트 파일이라
 * 여기서 순수 함수를 함께 export하면 react-refresh/only-export-components(Fast
 * Refresh) 규칙을 어긴다(hooks/useShuttle.js의 DEFAULT_CENTER와 동일한 이유).
 */

// 도메인 양끝에 살짝 패딩을 줘서 극값(p10/p90)이 트랙 끝에 완전히 붙지 않게 한다.
const DOMAIN_PADDING_RATIO = 0.06

/**
 * valueToPercent(value, min, max) — 순수 함수.
 * (value - min) / (max - min)로 정규화한 뒤, 도메인 양끝에 DOMAIN_PADDING_RATIO만큼
 * 패딩을 적용해 0~100(%) 범위의 위치를 반환한다.
 */
export function valueToPercent(value, min, max) {
  if (value == null || min == null || max == null || max <= min) return 50
  const ratio = (value - min) / (max - min)
  const padded = DOMAIN_PADDING_RATIO + ratio * (1 - DOMAIN_PADDING_RATIO * 2)
  return Math.min(100, Math.max(0, padded * 100))
}
