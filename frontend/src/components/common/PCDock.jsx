import { useEffect, useState } from 'react'
import {
  Map, CalendarDays, Utensils, MoreHorizontal,
  Locate, PanelLeftClose, PanelLeftOpen, Sun, Moon, Bell,
} from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

// PC 풀너비 검정 dock. 좌 4탭 + 중앙 정보(시각/날씨) + 우 빠른 액션.
// 높이 56px. 데스크탑(≥ md)에서만 표시.

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

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function PCDock() {
  const pathname = window.location.pathname
  const activeId = getActiveId(pathname)
  const now = useClock()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  const mapFullscreen = useAppStore((s) => s.mapFullscreen)
  const toggleMapFullscreen = useAppStore((s) => s.toggleMapFullscreen)
  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

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
      aria-label="PC 하단 dock"
      className="hidden md:flex h-[56px] items-center gap-1.5 px-3.5 bg-dock-bg border-t border-line-dark"
    >
      {TABS.map(({ id, Icon, href, label }) => {
        const active = activeId === id
        return (
          <a
            key={id}
            href={href}
            onClick={(e) => handleNav(e, href)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-[3px] w-16 h-11 rounded-btn pressable text-[9px] font-bold ${
              active ? 'bg-dock-active-bg text-white' : 'text-dock-text-mute'
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
            <span>{label}</span>
          </a>
        )
      })}

      <div className="w-px h-[26px] bg-line-dark mx-2" />

      <div className="flex items-center gap-2.5 text-dock-text text-[10px] font-bold">
        <span className="text-[13px] font-black text-white tracking-[-0.02em]">{hh}:{mm}</span>
        <span className="text-line-dark">·</span>
        <span>평일</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        title="패널 접고 지도 풀스크린"
        onClick={toggleMapFullscreen}
        className="flex items-center justify-center w-[34px] h-[34px] rounded-btn bg-dock-active-bg text-dock-text pressable"
      >
        {mapFullscreen
          ? <PanelLeftOpen size={16} aria-hidden="true" />
          : <PanelLeftClose size={16} aria-hidden="true" />}
      </button>
      <button
        type="button"
        title={darkMode ? '라이트 모드로' : '다크 모드로'}
        onClick={toggleDarkMode}
        className="flex items-center justify-center w-[34px] h-[34px] rounded-btn bg-dock-active-bg text-dock-text pressable"
      >
        {darkMode
          ? <Sun size={16} aria-hidden="true" />
          : <Moon size={16} aria-hidden="true" />}
      </button>
      <button
        type="button"
        title="GPS 재중심"
        className="flex items-center justify-center w-[34px] h-[34px] rounded-btn bg-dock-active-bg text-dock-text pressable"
      >
        <Locate size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        title="알림"
        className="flex items-center justify-center w-[34px] h-[34px] rounded-btn bg-accent text-black pressable"
      >
        <Bell size={16} aria-hidden="true" />
      </button>
    </nav>
  )
}
