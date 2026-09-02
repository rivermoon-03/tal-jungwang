/**
 * relativeTime — "N분 전" 상대 시각 표시 헬퍼.
 *
 * NoticeHighlights.jsx와 AppNoticesTab.jsx가 각자 같은 fmtDate를 인라인으로
 * 복붙해 들고 있었다(mistakes.md §2 — 표시 로직 인라인 복붙 금지 원칙 위반).
 * 신선도 행("N분 전 정보 + 새로고침")에도 그대로 재사용한다.
 */
export function formatRelativeTime(input, now = new Date()) {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}시간 전`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}
