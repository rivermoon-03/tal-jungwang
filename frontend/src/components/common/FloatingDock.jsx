import { Map, CalendarDays, Utensils, MoreHorizontal } from 'lucide-react'
import usePathname from '../../hooks/usePathname'

// 모바일 floating black dock. 라벨 없음, 아이콘만.
// 활성 = accent #4f9fff, 비활성 = mute-dark #6b7280.
// 위치: bottom 14px / left 14px / right 14px. radius 22px.

const TABS = [
  { id: 'map',       Icon: Map,            href: '/',          label: '지도'   },
  { id: 'schedule',  Icon: CalendarDays,   href: '/schedule',  label: '시간표' },
  { id: 'cafeteria', Icon: Utensils,       href: '/cafeteria', label: '학식'   },
  { id: 'more',      Icon: MoreHorizontal, href: '/more',      label: '더보기' },
]

function getActiveId(pathname) {
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/cafeteria')) return 'cafeteria'
  if (pathname.startsWith('/more'))      return 'more'
  return 'map'
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
      className="fixed left-[14px] right-[14px] bottom-[14px] z-50 md:hidden flex justify-around items-center py-[13px] rounded-dock-mob shadow-dock backdrop-blur-md"
      style={{
        background: 'rgba(10, 10, 10, 0.92)',
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
            className={`flex items-center justify-center w-[22px] h-[22px] pressable transition-colors duration-snap ease-ios ${
              active ? 'text-accent' : 'text-mute-dark'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
          </a>
        )
      })}
    </nav>
  )
}
