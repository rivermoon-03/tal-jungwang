import { Map, Building2, Megaphone, MoreHorizontal } from 'lucide-react'

/**
 * PC 셸(사이드바/구 dock) 공용 4탭 정의 + pushState 라우팅.
 *
 * PCDock과 PCSidebar가 동일한 배열/함수를 import해 쓴다 — 탭 목록이나 라우팅
 * 규칙이 두 곳에 따로 복붙되지 않게 한다(mistakes.md 2).
 */
export const PC_TABS = [
  { id: 'map',        Icon: Map,            href: '/',           label: '지도'     },
  { id: 'facilities', Icon: Building2,      href: '/facilities', label: '학교시설' },
  { id: 'notices',    Icon: Megaphone,      href: '/notices',    label: '공지'     },
  { id: 'more',       Icon: MoreHorizontal, href: '/more',       label: '더보기'   },
]

export function getActivePcTabId(pathname) {
  // 시간표는 지도(홈)의 하위 보기다 — 별도 탭이 아니라 같은 교통 정보의 다른 관점.
  if (pathname.startsWith('/schedule'))   return 'map'
  if (pathname.startsWith('/facilities')) return 'facilities'
  if (pathname.startsWith('/cafeteria'))  return 'facilities'
  if (pathname.startsWith('/notices'))    return 'notices'
  if (pathname.startsWith('/more'))       return 'more'
  // 상세 페이지는 진입 경로를 따라간다. 매핑이 없으면 아래 기본값 'map'으로 떨어져
  // 시간표에서 연 노선 상세인데 사이드바는 엉뚱한 탭을 가리키는 상태가 됐다.
  if (pathname.startsWith('/route/'))     return 'map'
  if (pathname.startsWith('/privacy'))    return 'more'
  return 'map'
}

/** history.pushState + popstate 디스패치로 App.jsx의 pathname 라우팅에 반영한다. */
export function navigateToPcTab(e, href) {
  e.preventDefault()
  if (window.location.pathname !== href) {
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
