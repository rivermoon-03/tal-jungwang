import { Map, Star, Calendar, MoreHorizontal } from 'lucide-react'

const TABS = [
  { id: 'map',       label: '지도',     Icon: Map,           href: '/'          },
  { id: 'favorites', label: '즐겨찾기', Icon: Star,          href: '/favorites' },
  { id: 'schedule',  label: '시간표',   Icon: Calendar,      href: '/schedule'  },
  { id: 'more',      label: '더보기',   Icon: MoreHorizontal, href: '/more'     },
]

function getActiveId(pathname) {
  if (pathname === '/' || pathname === '') return 'map'
  if (pathname.startsWith('/favorites')) return 'favorites'
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/more'))      return 'more'
  return 'map'
}

/**
 * BottomDock — 하단 4탭 독
 * React Router 없이 window.location 기반으로 active 탭 감지
 * (현 App.jsx가 hash-routing을 사용하므로 pathname 폴백으로 동작)
 */
export default function BottomDock() {
  const pathname = window.location.pathname

  const activeId = getActiveId(pathname)

  const handleNav = (e, href) => {
    e.preventDefault()
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href)
      // 라우트 변경 이벤트 발행 (App.jsx의 popstate 리스너 또는 별도 라우터가 처리)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden"
      style={{ bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
      role="navigation"
      aria-label="하단 탭 메뉴"
    >
      <nav
        className="flex items-center gap-1 bg-white dark:bg-surface-dark shadow-card border border-gray-100 dark:border-border-dark px-2 py-2"
        style={{ borderRadius: '24px' }}
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
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all
                active:scale-95
                ${active
                  ? 'text-coral'
                  : 'text-gray-400 dark:text-gray-500'
                }`}
              style={{ transition: 'color 0.15s var(--ease-ios), transform 0.1s var(--ease-spring)' }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden="true"
              />
              <span className={`text-[10px] mt-0.5 font-semibold ${active ? 'text-coral' : 'text-gray-400 dark:text-gray-500'}`}>
                {label}
              </span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
