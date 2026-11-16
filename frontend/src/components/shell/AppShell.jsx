import { BusFront, Ellipsis, House, Utensils } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { linkProps, useLocation } from '../../lib/nav'

const TABS = [
  { href: '/', label: '홈', Icon: House, match: (p) => p === '/' },
  { href: '/transit', label: '교통', Icon: BusFront, match: (p) => p.startsWith('/transit') },
  { href: '/cafeteria', label: '학식', Icon: Utensils, match: (p) => p.startsWith('/cafeteria') },
  { href: '/more', label: '더보기', Icon: Ellipsis, match: (p) => p.startsWith('/more') || p.startsWith('/notices') || p.startsWith('/privacy') },
]

/** 모바일은 하단 4탭, PC 는 왼쪽 사이드바 하나. */
export default function AppShell({ children }) {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const dark = pathname === '/' && !isDesktop

  if (isDesktop) {
    return (
      <div className="flex min-h-dvh bg-bg">
        <nav aria-label="메뉴" className="sticky top-0 flex h-dvh w-[200px] flex-none flex-col gap-1 border-r border-line-soft px-4 py-7">
          <span className="px-3 pb-5 text-f20 font-extrabold text-ink">탈:정왕</span>
          {TABS.map(({ href, label, Icon, match }) => {
            const on = match(pathname)
            return (
              <a
                key={href}
                {...linkProps(href)}
                aria-current={on ? 'page' : undefined}
                className={`flex h-11 items-center gap-2.5 rounded-xl px-3 text-f16 ${on ? 'bg-accent-bg font-extrabold text-accent-ink' : 'font-bold text-ink-2 hover:bg-surface-2'}`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </a>
            )
          })}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    )
  }

  return (
    <div className={`flex min-h-dvh flex-col ${dark ? 'bg-[#101211]' : 'bg-bg'}`}>
      <main className="flex-1 pb-[calc(76px+env(safe-area-inset-bottom))]">{children}</main>
      <nav
        aria-label="하단 탭"
        className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t pb-[env(safe-area-inset-bottom)] ${
          dark ? 'border-[#202221] bg-[#101211]' : 'border-line-soft bg-surface'
        }`}
      >
        {TABS.map(({ href, label, Icon, match }) => {
          const on = match(pathname)
          const color = on ? (dark ? 'text-[#12a594]' : 'text-accent-ink') : dark ? 'text-[#717d79]' : 'text-mute'
          return (
            <a
              key={href}
              {...linkProps(href)}
              aria-current={on ? 'page' : undefined}
              className={`flex h-[68px] flex-col items-center justify-center gap-1 text-f13 ${on ? 'font-extrabold' : 'font-bold'} ${color}`}
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
