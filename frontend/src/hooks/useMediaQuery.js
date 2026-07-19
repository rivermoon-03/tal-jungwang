import { useEffect, useState } from 'react'

// 표준 matchMedia 구독 훅. SSR 안전 (window 없으면 false).
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
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
