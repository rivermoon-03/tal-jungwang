import { useEffect, useRef } from 'react'
import { BusFront, Ellipsis, House, Utensils } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { linkProps, useLocation } from '../../lib/nav'

const TABS = [
  { href: '/', label: '홈', Icon: House, match: (p) => p === '/' },
  { href: '/transit', label: '교통', Icon: BusFront, match: (p) => p.startsWith('/transit') },
  { href: '/cafeteria', label: '학식', Icon: Utensils, match: (p) => p.startsWith('/cafeteria') },
  { href: '/more', label: '더보기', Icon: Ellipsis, match: (p) => p.startsWith('/more') || p.startsWith('/notices') || p.startsWith('/privacy') },
]

/**
 * 모바일은 떠 있는 아이콘 독, PC 는 왼쪽 사이드바 하나.
 * html, body, #root 가 overflow: hidden 이라 스크롤은 main 이 맡는다. 화면을 옮기면 main 을 맨 위로 돌린다.
 */
export default function AppShell({ children }) {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const dark = pathname === '/' && !isDesktop
  const activeIndex = TABS.findIndex((tab) => tab.match(pathname))

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  if (isDesktop) {
    return (
      <div className="flex h-dvh bg-bg">
        <nav aria-label="메뉴" className="flex h-dvh w-[200px] flex-none flex-col gap-1 border-r border-line-soft px-4 py-7">
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
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className={`relative flex h-dvh flex-col ${dark ? 'bg-[#101211]' : 'bg-bg'}`}>
      {/* iOS PWA(black-translucent)는 상태 표시줄 밑까지 그리므로 위쪽 안전 영역을 비운다. 안드로이드는 0 이다. */}
      <div aria-hidden="true" className="h-[env(safe-area-inset-top)] flex-none" />
      {/* 세로 flex 라 홈이 flex-1 로 배너를 뺀 남은 높이를 채운다. 홈 카드가 독 바로 위에 붙는 기준이다. */}
      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(84px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <nav
        aria-label="하단 탭"
        className={`fixed bottom-[max(14px,calc(env(safe-area-inset-bottom)-12px))] left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border p-1.5 shadow-lg ${
          dark ? 'border-[#272a29] bg-[#1a211e]' : 'border-line bg-surface'
        }`}
      >
        {/* 선택 표시는 아이콘 사이를 미끄러져 옮겨 간다. 버튼 폭 56px, 간격 4px */}
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className={`tj-slide-thumb absolute left-1.5 top-1.5 h-12 w-14 rounded-full ${dark ? 'bg-[#0d2d2a]' : 'bg-accent-bg'}`}
            style={{ transform: `translateX(${activeIndex * 60}px)` }}
          />
        )}
        {TABS.map(({ href, label, Icon, match }) => {
          const on = match(pathname)
          const tone = on ? (dark ? 'text-[#12a594]' : 'text-accent-ink') : dark ? 'text-[#868e8b]' : 'text-mute'
          return (
            <a
              key={href}
              {...linkProps(href)}
              aria-label={label}
              aria-current={on ? 'page' : undefined}
              className={`relative flex h-12 w-14 items-center justify-center rounded-full transition-colors duration-150 ${tone}`}
            >
              <Icon size={23} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
            </a>
          )
        })}
      </nav>
    </div>
  )
}
