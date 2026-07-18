import { Home, Clock, Utensils, MoreHorizontal } from 'lucide-react'
import usePathname from '../../hooks/usePathname'

// 모바일 floating dock. 아이콘만(시각 텍스트 라벨 없음).
// 활성 = accent, 비활성 = white/60.
// 위치: bottom 14px / left 14px / right 14px. radius 22px.
// 4탭: 홈/시간표/학식/더보기 (frontend/test/Screens.jsx 시안 확정).

const TABS = [
  { id: 'home',      Icon: Home,           href: '/',          label: '홈'     },
  { id: 'schedule',  Icon: Clock,          href: '/schedule',  label: '시간표' },
  { id: 'cafeteria', Icon: Utensils,       href: '/cafeteria', label: '학식'   },
  { id: 'more',      Icon: MoreHorizontal, href: '/more',      label: '더보기' },
]

function getActiveId(pathname) {
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/cafeteria')) return 'cafeteria'
  if (pathname.startsWith('/more'))      return 'more'
  return 'home'
}

export default function FloatingDock() {
  const pathname = usePathname()
  const activeId = getActiveId(pathname)

  const handleNav = (e, href) => {
    e.preventDefault()
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  return (
    <nav
      role="navigation"
      aria-label="하단 탭 메뉴"
      className="fixed left-[14px] right-[14px] bottom-[14px] z-50 flex justify-around items-center py-[9px] rounded-sheet shadow-dock"
      style={{
        background: 'var(--tj-dock-bg, #1a211e)',
        marginBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ id, Icon, href, label }) => {
        const active = activeId === id
        return (
          <a
            key={id}
            href={href}
            onClick={(e) => handleNav(e, href)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center min-w-[44px] min-h-[44px] pressable transition-colors duration-snap ease-out ${
              active ? 'text-accent' : 'text-white/60'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
          </a>
        )
      })}
    </nav>
  )
}
