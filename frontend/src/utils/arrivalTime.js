/**
 * arrivalTime.js — 도착 시간 표시 유틸
 *
 * formatArrival(secondsLeft)
 *   secondsLeft: 지금부터 출발까지 남은 초 (백엔드 arrive_in_seconds 필드)
 *   반환값:
 *     - secondsLeft == null  → null  (표시 없음)
 *     - 남은 시간 ≤ 60분    → "N분"
 *     - 남은 시간 > 60분    → "HH:MM" (절대 시각)
 *     - secondsLeft < 0     → "곧 출발"
 *
 * formatArrivalFromTime(departAtStr)
 *   departAtStr: "HH:MM" 또는 "HH:MM:SS" 형식의 출발 시각 문자열
 *   지금 시각과 비교하여 위와 동일한 규칙으로 반환.
 */

/**
 * 남은 초를 기반으로 도착 표시 문자열을 반환.
 * @param {number|null} secondsLeft
 * @returns {string|null}
 */
export function formatArrival(secondsLeft) {
  if (secondsLeft == null) return null
  if (secondsLeft < 0) return '곧 출발'
  const mins = Math.ceil(secondsLeft / 60)
  if (mins <= 60) return `${mins}분`
  // > 60분 → 절대 시각으로 표시
  const arrival = new Date(Date.now() + secondsLeft * 1000)
  const hh = String(arrival.getHours()).padStart(2, '0')
  const mm = String(arrival.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * "HH:MM" 또는 "HH:MM:SS" 출발 시각 문자열을 현재 시각과 비교.
 * @param {string} departAtStr
 * @returns {string|null}
 */
export function formatArrivalFromTime(departAtStr) {
  if (!departAtStr) return null
  const now = new Date()
  const [hStr, mStr] = departAtStr.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return departAtStr

  const departDate = new Date(now)
  departDate.setHours(h, m, 0, 0)

  // 자정 이후 시간표가 다음날 날짜로 잡히는 경우 보정하지 않음
  // (백엔드가 arrive_in_seconds를 제공하므로 이 함수는 fallback용)
  const diffSec = Math.floor((departDate.getTime() - now.getTime()) / 1000)
  return formatArrival(diffSec)
}
