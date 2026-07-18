/**
 * noticeDate — 공지사항류(서비스 공지 · 학사공지) 날짜 표시 헬퍼.
 *
 * "YYYY년 M월 D일" 전체 날짜 포맷을 NoticesPage.jsx(서비스 공지)와
 * AcademicNoticesTab.jsx(학과 공지)가 각자 인라인으로 복붙하지 않도록
 * 한 곳으로 모은다(mistakes.md §2 — 표시 로직 인라인 복붙 금지 원칙).
 */
export function formatFullDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}
