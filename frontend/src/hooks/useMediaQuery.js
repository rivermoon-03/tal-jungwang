import { useCallback, useSyncExternalStore } from 'react'

/**
 * 표준 matchMedia 구독 훅. SSR 안전 (window 없으면 false).
 *
 * matchMedia는 React 바깥의 외부 스토어라서 useSyncExternalStore가 정석이다.
 * 예전에는 useState와 useEffect로 구독하면서 effect 안에서 현재 값을 다시
 * setState 했는데, 이러면 첫 렌더 직후 렌더가 한 번 더 돌고 동시성 렌더에서
 * 찢어진 값을 볼 여지도 있었다.
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback((onStoreChange) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onStoreChange)
    return () => mql.removeEventListener('change', onStoreChange)
  }, [query])

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }, [query])

  // 서버 스냅샷은 항상 false — 클라이언트에서 마운트되며 실제 값으로 맞춰진다.
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// Tailwind md 브레이크포인트(≥ 768px) — PC 레이아웃 분기에 사용.
export function useIsDesktop() {
  return useMediaQuery('(min-width: 768px)')
}

// 360px 미만 좁은 폰(iPhone SE 1세대 등) 판정. 시간표 그리드/리스트가
// 가로 여백 부족으로 잘리는 문제(F4-2)의 분기 기준 — CSS 숨김이 아니라
// 이 훅으로 JS 조건부 마운트해 좁은 화면 전용 가로 스크롤 레이아웃으로 바꾼다.
export function useIsNarrowPhone() {
  return useMediaQuery('(max-width: 359px)')
}
