import { Map, Calendar, BarChart2, MoreHorizontal } from 'lucide-react'

const TABS = [
  { id: 'map',      label: '홈',     Icon: Map,            href: '/'         },
  { id: 'schedule', label: '시간표', Icon: Calendar,       href: '/schedule' },
  { id: 'stats',    label: '통계',   Icon: BarChart2,      href: '/stats'    },
  { id: 'more',     label: '더보기', Icon: MoreHorizontal, href: '/more'     },
]

function getActiveId(pathname) {
  if (pathname === '/' || pathname === '') return 'map'
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/stats'))     return 'stats'
  if (pathname.startsWith('/more'))      return 'more'
  return 'map'
}

/**
 * BottomDock — 플랫한 하단 고정 4탭 독.
 * 디자인 번들 정렬: active=ink/accent-dark, idle=mute-2, 라벨 micro(10px).
 */
export default function BottomDock() {
  const pathname = window.location.pathname
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
      className="fixed left-0 right-0 bottom-0 z-50 md:hidden flex items-stretch bg-white dark:bg-bg-dark border-t border-gray-200 dark:border-border-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(({ id, label, Icon, href }) => {
        const active = activeId === id
        const colorClass = active
          ? 'text-ink dark:text-accent-dark'
          : 'text-mute-2'
        return (
          <a
            key={id}
            href={href}
            onClick={(e) => handleNav(e, href)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 min-h-[60px] flex flex-col items-center justify-center gap-1 pressable ${colorClass}`}
            style={{ transition: 'transform var(--dur-press) var(--ease-ios)' }}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
            <span className="text-micro" style={{ fontWeight: 800 }}>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
