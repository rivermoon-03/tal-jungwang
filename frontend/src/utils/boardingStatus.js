/**
 * 버스/지하철 도착 시간 관련 공유 유틸리티
 */

/** 초 → 분 (내림). null/undefined 입력 시 null 반환. */
export function toMin(sec) {
  if (sec == null) return null
  return Math.floor(sec / 60)
}

/**
 * 도보 시간 대비 도착 여유 판단.
 * @param {number} arriveInSec - 버스/지하철 도착까지 남은 초
 * @param {number} walkSec     - 정류장까지 도보 소요 초
 */
export function getBoardingStatus(arriveInSec, walkSec) {
  const margin = arriveInSec - walkSec
  if (margin >= 300) return { label: '여유',   bg: '#dcfce7', color: '#15803d' }
  if (margin >= 60)  return { label: '빠듯',   bg: '#fef9c3', color: '#a16207' }
  return               { label: '서둘러', bg: '#fee2e2', color: '#b91c1c' }
}
