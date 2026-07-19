import { Map, CalendarDays, Utensils, MoreHorizontal } from 'lucide-react'

/**
 * PC 셸(사이드바/구 dock) 공용 4탭 정의 + pushState 라우팅.
 *
 * PCDock과 PCSidebar가 동일한 배열/함수를 import해 쓴다 — 탭 목록이나 라우팅
 * 규칙이 두 곳에 따로 복붙되지 않게 한다(mistakes.md 2).
 */
export const PC_TABS = [
  { id: 'map',       Icon: Map,            href: '/',          label: '지도'   },
  { id: 'schedule',  Icon: CalendarDays,   href: '/schedule',  label: '시간표' },
  { id: 'cafeteria', Icon: Utensils,       href: '/cafeteria', label: '학식'   },
  { id: 'more',      Icon: MoreHorizontal, href: '/more',      label: '더보기' },
]

export function getActivePcTabId(pathname) {
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/cafeteria')) return 'cafeteria'
  if (pathname.startsWith('/more'))      return 'more'
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
