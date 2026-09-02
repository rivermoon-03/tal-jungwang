/**
 * cafeteriaFormat.js — 학식 화면 표시 포맷 헬퍼
 *
 * 모바일(CafeteriaPage)과 PC(CafeteriaVenueRail/CafeteriaPCLayout)가 같은
 * "갱신 시각" 텍스트를 보여줘야 하므로 한 곳에서만 포맷팅한다.
 */
import { formatHHMM } from './eta'

/**
 * fetched_at ISO -> "HH:MM 갱신" 문자열. 파싱 실패 시 null.
 *
 * 시각은 KST 로 고정한다. 예전에는 getHours() 로 브라우저 로컬 시각을 찍었는데,
 * 백엔드가 주는 fetched_at 은 KST 라 한국에서만 우연히 맞았다. 다른 시간대에서
 * 보면 갱신 시각이 통째로 어긋난다.
 *
 * @param {string} iso
 * @returns {string|null}
 */
export function formatUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${formatHHMM(d.getTime())} 갱신`
}
