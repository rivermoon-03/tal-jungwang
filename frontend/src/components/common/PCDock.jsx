import { useEffect, useRef, useState } from 'react'
import {
  Map, CalendarDays, Utensils, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Sun, Moon, Bell,
  Cloud, CloudSun, CloudRain, CloudSnow,
} from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useWeather } from '../../hooks/useWeather'
import { useNotices } from '../../hooks/useMore'
import usePathname from '../../hooks/usePathname'
import NoticesPopover from './NoticesPopover'

// PC 풀너비 검정 dock. 좌측 4탭 + 시각/요일/날씨 + 우측 빠른 액션.
// 차량 인포테인먼트 톤 — 큼직한 아이콘, 넉넉한 spacing.

const TABS = [
  { id: 'map',       Icon: Map,            href: '/',          label: '지도'   },
  { id: 'schedule',  Icon: CalendarDays,   href: '/schedule',  label: '시간표' },
  { id: 'cafeteria', Icon: Utensils,       href: '/cafeteria', label: '학식'   },
  { id: 'more',      Icon: MoreHorizontal, href: '/more',      label: '더보기' },
]

const WEATHER_ICONS = {
  sunny: Sun,
  partly_cloudy: CloudSun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
}

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

function dayTypeLabel(d) {
  const dow = d.getDay()
  return (dow === 0 || dow === 6) ? '주말' : '평일'
}

export default function PCDock() {
  const pathname = usePathname()
  const activeId = getActiveId(pathname)
  const now = useClock()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const dayLabel = dayTypeLabel(now)

  const mapFullscreen = useAppStore((s) => s.mapFullscreen)
  const toggleMapFullscreen = useAppStore((s) => s.toggleMapFullscreen)
  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  const { weather } = useWeather()
  const WeatherIcon = WEATHER_ICONS[weather?.icon] ?? Sun

  // 공지사항 팝오버
  const { data: notices } = useNotices()
  const hasNotices = Array.isArray(notices) && notices.length > 0
  const [noticesOpen, setNoticesOpen] = useState(false)
  const bellRef = useRef(null)

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
      className="hidden md:flex h-[68px] items-center gap-3 px-5 bg-dock-bg border-t border-line-dark"
    >
      {/* 탭들 */}
      <div className="flex items-center gap-2">
        {TABS.map(({ id, Icon, href, label }) => {
          const active = activeId === id
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => handleNav(e, href)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 w-[68px] h-[52px] rounded-btn pressable text-[11px] font-bold transition-colors duration-snap ease-ios ${
                active ? 'bg-dock-active-bg text-white' : 'text-dock-text-mute hover:text-dock-text'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
              <span>{label}</span>
            </a>
          )
        })}
      </div>

      <div className="w-px h-9 bg-line-dark mx-1" />

      {/* 시각 · 요일 */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-black text-white tracking-[-0.02em] tabular-nums leading-none">
            {hh}:{mm}
          </span>
          <span className="text-[12px] font-bold text-dock-text leading-none">{dayLabel}</span>
        </div>

        <div className="w-px h-6 bg-line-dark" />

        {/* 날씨 */}
        <div className="flex items-center gap-2 text-dock-text">
          <WeatherIcon size={20} strokeWidth={2} className="text-white/85" aria-hidden="true" />
          <span className="text-[16px] font-black text-white tabular-nums leading-none">
            {weather?.currentTemp != null ? `${weather.currentTemp}°` : '--°'}
          </span>
          {weather?.currentSky && (
            <span className="text-[11px] font-semibold text-dock-text-mute leading-none">
              {weather.currentSky}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* 빠른 액션 */}
      <button
        type="button"
        title="패널 접고 지도 풀스크린"
        onClick={toggleMapFullscreen}
        className="flex items-center justify-center w-10 h-10 rounded-btn bg-dock-active-bg text-dock-text hover:text-white pressable transition-colors duration-snap ease-ios"
      >
        {mapFullscreen
          ? <PanelLeftOpen size={18} aria-hidden="true" />
          : <PanelLeftClose size={18} aria-hidden="true" />}
      </button>
      <button
        type="button"
        title={darkMode ? '라이트 모드로' : '다크 모드로'}
        onClick={toggleDarkMode}
        className="flex items-center justify-center w-10 h-10 rounded-btn bg-dock-active-bg text-dock-text hover:text-white pressable transition-colors duration-snap ease-ios"
      >
        {darkMode
          ? <Sun size={18} aria-hidden="true" />
          : <Moon size={18} aria-hidden="true" />}
      </button>
      <button
        ref={bellRef}
        type="button"
        title="공지사항"
        aria-haspopup="dialog"
        aria-expanded={noticesOpen}
        onClick={() => setNoticesOpen((v) => !v)}
        className={`relative flex items-center justify-center w-10 h-10 rounded-btn pressable transition-colors duration-snap ease-ios ${
          noticesOpen ? 'bg-white text-black' : 'bg-accent text-black hover:opacity-90'
        }`}
      >
        <Bell size={18} aria-hidden="true" />
        {hasNotices && !noticesOpen && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-imminent border border-dock-bg"
          />
        )}
      </button>
      <NoticesPopover
        open={noticesOpen}
        onClose={() => setNoticesOpen(false)}
        anchorRef={bellRef}
      />
    </nav>
  )
}
