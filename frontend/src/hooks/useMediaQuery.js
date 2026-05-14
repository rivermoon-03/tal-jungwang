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
