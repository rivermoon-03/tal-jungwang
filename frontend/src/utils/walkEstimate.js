/**
 * walkEstimate.js — 직선거리(m) → 도보 소요 분 근사 헬퍼.
 *
 * NearestStopCard(지도 최근접 정류장 카드)가 haversine으로 구한 사용자↔정류장
 * 직선거리를 "도보 N분" 라벨로 바꿀 때 쓴다. 실측 보행 경로가 아닌 직선거리
 * 근사이므로 오차가 있을 수 있어, 아주 가까운 거리도 "0분"으로 보여 오해를
 * 주지 않도록 최소 1분으로 올림한다.
 *
 * 기준: 평균 도보 속도 약 4.8km/h ≈ 80m/분 (WALK_METERS_PER_MINUTE).
 * 반올림 정책은 이 헬퍼 하나로 고정한다 — 화면마다 인라인 Math.* 로 다시
 * 계산하면 값이 어긋난다(mistakes.md §2와 동일한 함정).
 */

export const WALK_METERS_PER_MINUTE = 80

/**
 * @param {number|null} distanceMeters
 * @returns {number|null} 도보 소요 분(정수). distanceMeters가 없으면 null.
 */
export function metersToWalkMinutes(distanceMeters) {
  if (distanceMeters == null || Number.isNaN(distanceMeters)) return null
  if (distanceMeters <= 0) return 0
  return Math.max(1, Math.ceil(distanceMeters / WALK_METERS_PER_MINUTE))
}
