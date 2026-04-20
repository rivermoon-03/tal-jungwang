import { useState, useEffect } from 'react'
import { Zap, Map, CalendarDays, MoreHorizontal, Moon, Sun } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'now',      label: '지금',   Icon: Zap,            href: '/'         },
  { id: 'map',      label: '지도',   Icon: Map,            href: '/map'      },
  { id: 'schedule', label: '시간표', Icon: CalendarDays,   href: '/schedule' },
  { id: 'more',     label: '더보기', Icon: MoreHorizontal, href: '/more'     },
]

function getActiveId(pathname) {
  if (pathname === '/' || pathname === '') return 'now'
  if (pathname.startsWith('/map'))       return 'map'
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/more'))      return 'more'
  return 'now'
}

export default function PCNavbar() {
  const darkMode       = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const activeId = getActiveId(pathname)

  const handleNav = (e, href) => {
    e.preventDefault()
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  return (
    <header className="flex items-center gap-4 bg-white/95 dark:bg-[#1e2128]/95 backdrop-blur-md border-b border-slate-200/60 dark:border-border-dark/60 px-6 h-14 shrink-0 shadow-sm">
      {/* 로고 */}
      <span className="font-a2z text-xl font-black text-slate-900 dark:text-white mr-2 select-none">
        탈정왕
      </span>

      {/* 탭 */}
      <nav className="flex items-center gap-0.5" aria-label="메인 메뉴">
        {TABS.map(({ id, label, Icon, href }) => {
          const active = activeId === id
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => handleNav(e, href)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors
                ${active
                  ? 'bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
            >
              <Icon size={16} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
              {label}
            </a>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* 다크모드 토글 */}
      <button
        aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        onClick={toggleDarkMode}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all
          bg-slate-100 dark:bg-surface-dark hover:bg-slate-200 dark:hover:bg-slate-700"
      >
        {darkMode
          ? <Sun  size={16} strokeWidth={2} className="text-yellow-500" />
          : <Moon size={16} strokeWidth={2} className="text-slate-600 dark:text-slate-300" />
        }
      </button>
    </header>
  )
}
