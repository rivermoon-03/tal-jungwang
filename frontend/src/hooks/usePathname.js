import { useEffect, useState } from 'react'

// pushState + popstate 기반 라우팅에서 현재 pathname을 구독한다.
// 도크 등 경로 변화에 따라 active 표시를 갱신해야 하는 컴포넌트에서 사용.
export default function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return pathname
}
