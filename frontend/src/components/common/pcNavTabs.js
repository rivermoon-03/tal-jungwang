import { Home, Building2, Megaphone, MoreHorizontal } from 'lucide-react'

/**
 * PC 셸(PCSidebar) 공용 4탭 정의 + pushState 라우팅.
 *
 * 구 PC dock(PCDock, 2026-09 삭제 — App.jsx가 더 이상 마운트하지 않던 죽은
 * 코드)도 한때 이 배열/함수를 같이 썼다. PCSidebar만 남은 지금도 탭 목록·
 * 라우팅 규칙을 이 파일 한 곳에서만 관리하는 구조는 그대로 유지한다.
 *
 * id는 'map'을 그대로 쓰지만(서브내비 분기 등 내부 참조가 많아 값 자체를
 * 바꾸면 변경 범위가 커진다) 라벨과 아이콘은 '홈'/Home으로 맞춘다 — 모바일
 * FloatingDock의 첫 탭도 '홈'인데 PC만 '지도'라 같은 화면을 가리키면서
 * 이름이 갈리고 있었다(요구사항: 모바일·PC 상위 탭 이름을 맞출 것).
 */
export const PC_TABS = [
  { id: 'map',        Icon: Home,           href: '/',           label: '홈'       },
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
