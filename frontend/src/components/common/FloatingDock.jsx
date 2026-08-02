import { useRef, useState } from 'react'
import { Home, Building2, Megaphone, MoreHorizontal } from 'lucide-react'
import usePathname from '../../hooks/usePathname'
import DockQuickAccess from './DockQuickAccess'

// 모바일 floating dock. 아이콘 + 12px 라벨(아이콘 아래).
// 활성 = accent, 비활성 = white/60.
// 위치: bottom 14px / left 14px / right 14px. radius 22px.
// 4탭: 홈/학교시설/공지/더보기.
// 시간표는 별도 탭이 아니라 홈 안의 보기 전환("지금 ↔ 시간표")이 됐다 — 같은 모드를
// 두 화면에서 각각 고르던 구조를 없애면서 탭 한 자리가 비었고, 그 자리를 공지가 받는다.
// 홈 탭 롱프레스(500ms) → 즐겨찾기 팝오버(예전 시간표 탭이 갖던 동작).
// 결함 #31: 라벨 없이 아이콘만으로는 초행 사용자가 탭 의미를 알기 어려웠다
// — 아이콘 아래 12px 라벨을 추가하되 터치 타깃(44px)은 그대로 유지한다.

const TABS = [
  { id: 'home',       Icon: Home,           href: '/',           label: '홈'       },
  { id: 'facilities', Icon: Building2,      href: '/facilities', label: '학교시설' },
  { id: 'notices',    Icon: Megaphone,      href: '/notices',    label: '공지'     },
  { id: 'more',       Icon: MoreHorizontal, href: '/more',       label: '더보기'   },
]

function getActiveId(pathname) {
  // /cafeteria 는 학교시설의 옛 주소다(북마크·위젯 딥링크가 아직 쓴다).
  if (pathname.startsWith('/facilities') || pathname.startsWith('/cafeteria')) return 'facilities'
  if (pathname.startsWith('/notices'))   return 'notices'
  if (pathname.startsWith('/more'))      return 'more'
  return 'home'
}

export default function FloatingDock() {
  const pathname = usePathname()
  const activeId = getActiveId(pathname)
  const [longPressActive, setLongPressActive] = useState(false)
  const longPressTimerRef = useRef(null)
  const longPressTriggeredRef = useRef(false)

  const handleNav = (e, href) => {
    e.preventDefault()
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  const startLongPress = () => {
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setLongPressActive(true)
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }, 500)
  }

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCloseDockQuickAccess = () => {
    setLongPressActive(false)
    longPressTriggeredRef.current = false
  }

  return (
    <nav
      role="navigation"
      aria-label="하단 탭 메뉴"
      className="fixed left-[14px] right-[14px] bottom-[14px] z-50 flex justify-around items-center py-[9px] rounded-sheet shadow-dock"
      style={{
        background: 'var(--tj-dock-bg)',
        marginBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ id, Icon, href, label }) => {
        const active = activeId === id
        const isSchedule = id === 'home'
        return (
          <a
            key={id}
            href={href}
            onClick={(e) => handleNav(e, href)}
            onPointerDown={isSchedule ? startLongPress : undefined}
            onPointerUp={isSchedule ? endLongPress : undefined}
            onPointerLeave={isSchedule ? endLongPress : undefined}
            onPointerCancel={isSchedule ? endLongPress : undefined}
            onContextMenu={(e) => {
              if (isSchedule) e.preventDefault()
            }}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            style={isSchedule ? { touchAction: 'none' } : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] pressable transition-colors duration-snap ease-out ${
              active ? 'text-accent' : 'text-white/60'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
            <span className="text-[12px] leading-none font-semibold">{label}</span>
          </a>
        )
      })}
      {longPressActive && <DockQuickAccess onClose={handleCloseDockQuickAccess} />}
    </nav>
  )
}
