import { Map, Star, Calendar, MoreHorizontal } from 'lucide-react'

const TABS = [
  { id: 'map',       label: '지도',     Icon: Map,            href: '/'          },
  { id: 'favorites', label: '즐겨찾기', Icon: Star,           href: '/favorites' },
  { id: 'schedule',  label: '시간표',   Icon: Calendar,       href: '/schedule'  },
  { id: 'more',      label: '더보기',   Icon: MoreHorizontal, href: '/more'      },
]

function getActiveId(pathname) {
  if (pathname === '/' || pathname === '') return 'map'
  if (pathname.startsWith('/favorites')) return 'favorites'
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/more'))      return 'more'
  return 'map'
}

/**
 * BottomDock — 플로팅 필 스타일 하단 4탭 독 (라벨 없음)
 * React Router 없이 window.location 기반으로 active 탭 감지
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
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden"
      style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
      role="navigation"
      aria-label="하단 탭 메뉴"
    >
      <nav
        className="flex items-center gap-1 bg-white/95 dark:bg-[#1e2128]/95 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 px-2 py-2 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
      >
        {TABS.map(({ id, label, Icon, href }) => {
          const active = activeId === id
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => handleNav(e, href)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] w-14 h-14 rounded-full transition-colors active:scale-95
                ${active
                  ? 'text-coral'
                  : 'text-slate-500 dark:text-slate-400'
                }`}
              style={{ transition: 'color 0.2s ease, transform 0.1s ease' }}
            >
              <Icon
                size={23}
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden="true"
              />
              {/* active indicator dot */}
              {active && (
                <span
                  className="absolute bottom-[8px] w-1 h-1 rounded-full bg-coral"
                  aria-hidden="true"
                />
              )}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
