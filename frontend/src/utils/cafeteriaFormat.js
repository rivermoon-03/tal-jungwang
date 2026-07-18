/**
 * cafeteriaFormat.js — 학식 화면 표시 포맷 헬퍼
 *
 * 모바일(CafeteriaPage)과 PC(CafeteriaVenueRail/CafeteriaPCLayout)가 같은
 * "갱신 시각" 텍스트를 보여줘야 하므로 한 곳에서만 포맷팅한다.
 */

/**
 * fetched_at ISO → "HH:MM 갱신" 문자열. 파싱 실패 시 null.
 *
 * @param {string} iso
 * @returns {string|null}
 */
export function formatUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mi} 갱신`
}
