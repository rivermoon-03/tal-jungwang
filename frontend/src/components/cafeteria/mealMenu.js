/**
 * 학식 메뉴 판정 헬퍼.
 *
 * 컴포넌트 파일에서 분리해 둔다 — 컴포넌트와 일반 함수를 한 파일에서 함께
 * export하면 fast refresh가 동작하지 않는다.
 */

/** 빈 메뉴 여부 판정 — 빈 배열 또는 ["미운영"] 단독 */
export function isEmptyMenu(items) {
  if (!items || items.length === 0) return true
  if (items.length === 1 && items[0] === '미운영') return true
  return false
}
