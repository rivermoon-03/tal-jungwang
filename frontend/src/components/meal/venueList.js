import { CATEGORY_GROUPS } from '../../data/cafeteriaVenues'
import { isOpenNow } from '../../utils/venueOpen'

const SOON_MIN = 30

/** 영업 상태 → Pill 종류 */
export function pillKindOf(status) {
  if (status === 'open' || status === 'always') return 'open'
  if (status === 'closing' || status === 'before_open') return 'soon'
  return 'closed'
}

/**
 * 카테고리별 매장 목록. onlyOpen 이면 영업 중과 30분 안에 여는 곳만 남긴다.
 * 그룹 안에서는 영업 중, 곧 엶, 나머지 순이다.
 */
export function venuesByCategory(now, onlyOpen) {
  const rank = (s) => (s.open ? 0 : s.status === 'before_open' ? 1 : 2)
  return CATEGORY_GROUPS.map((g) => {
    const rows = g.venues
      .map((v) => ({ venue: v, state: isOpenNow(v, now) }))
      .filter(({ state }) => !onlyOpen || state.open || (state.minutesUntilOpen ?? Infinity) <= SOON_MIN)
      .sort((a, b) => rank(a.state) - rank(b.state))
    return { key: g.key, label: g.label, rows }
  }).filter((g) => g.rows.length > 0)
}

export function openCount(groups) {
  return groups.reduce((n, g) => n + g.rows.filter((r) => r.state.open).length, 0)
}
