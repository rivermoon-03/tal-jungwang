import { useRef, useState } from 'react'
import { Bell, Settings as SettingsIcon, Sun, Moon, Bus, Train } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import usePathname from '../../hooks/usePathname'
import { useNotices } from '../../hooks/useMore'
import { PC_TABS, getActivePcTabId, navigateToPcTab } from '../common/pcNavTabs'
import NoticesPopover from '../common/NoticesPopover'
import PCWeatherSummary from '../dashboard/PCWeatherSummary'

/**
 * PCSidebar — 데스크톱 전용 좌측 반투명 사이드바(폭 약 236px).
 *
 * pc-mockup.html의 .sidebar(반투명 A) 구성을 그대로 옮긴다: 브랜드 → 날씨 위젯
 * (PCWeatherSummary 재사용) → 4탭 네비(PCDock과 동일한 pcNavTabs 공유) →
 * 즐겨찾기 요약(useAppStore.favorites) → 설정 진입 → footer(다크모드 토글 +
 * 공지 벨 — 이전에 PCDock이 갖던 기능을 이관).
 */
export default function PCSidebar() {
  const pathname = usePathname()
  const activeId = getActivePcTabId(pathname)

  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
  const favorites = useAppStore((s) => s.favorites)
  const favoriteRoutes = favorites?.routes ?? []

  const { data: notices } = useNotices()
  const hasNotices = Array.isArray(notices) && notices.length > 0
  const [noticesOpen, setNoticesOpen] = useState(false)
  const bellRef = useRef(null)

  const goSettings = (e) => navigateToPcTab(e, '/more')

  return (
    <aside
      aria-label="사이드바"
      className="flex h-full w-[236px] flex-none flex-col gap-1 overflow-y-auto border-r border-line bg-surface-2/85 px-3 py-4 backdrop-blur-xl backdrop-saturate-150 dark:bg-surface/85"
    >
      {/* 브랜드 */}
      <div className="mb-1 flex items-center gap-2.5 px-2 pb-2">
        <div
          aria-hidden="true"
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-badge bg-gradient-to-br from-accent to-accent-hover text-white shadow-pill"
        >
          <Bus size={17} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-caption font-extrabold tracking-[-0.02em] text-ink">탈것:정왕</p>
          <p className="truncate text-micro font-semibold text-mute">정왕 교통 · 실시간</p>
        </div>
      </div>

      {/* 날씨 위젯 */}
      <div className="mb-2 rounded-card border border-line bg-surface px-3 py-2.5">
        <PCWeatherSummary />
      </div>

      {/* 4탭 네비 */}
      <nav className="flex flex-col gap-0.5" aria-label="주요 메뉴">
        {PC_TABS.map(({ id, Icon, href, label }) => {
          const active = activeId === id
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => navigateToPcTab(e, href)}
              aria-current={active ? 'page' : undefined}
              className={`pressable flex items-center gap-[11px] rounded-button px-3 py-[9px] text-caption font-semibold transition-colors duration-snap ease-out ${
                active ? 'bg-accent-bg text-accent-ink' : 'text-ink-2 hover:bg-ink/[0.06]'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" className={active ? 'text-accent' : 'text-mute'} />
              {label}
            </a>
          )
        })}
      </nav>

      {/* 즐겨찾기 */}
      {favoriteRoutes.length > 0 && (
        <div className="mt-3">
          <p className="px-3 pb-1 text-micro font-bold uppercase tracking-[.07em] text-mute">즐겨찾기</p>
          <ul className="flex flex-col gap-0.5">
            {favoriteRoutes.map((routeKey) => {
              const isSubway = routeKey.startsWith('subway:')
              const label = isSubway ? routeKey.replace('subway:', '').replace(':', ' ') : routeKey
              return (
                <li key={routeKey}>
                  <button
                    type="button"
                    onClick={goSettings}
                    className="pressable flex w-full items-center gap-[11px] rounded-button py-[7px] pl-[22px] pr-3 text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
                  >
                    {isSubway
                      ? <Train size={15} className="flex-none text-mute" aria-hidden="true" />
                      : <Bus size={15} className="flex-none text-mute" aria-hidden="true" />}
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 설정 */}
      <div className="mt-3">
        <p className="px-3 pb-1 text-micro font-bold uppercase tracking-[.07em] text-mute">설정</p>
        <a
          href="/more"
          onClick={goSettings}
          className="pressable flex items-center gap-[11px] rounded-button px-3 py-[9px] text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
        >
          <SettingsIcon size={18} className="text-mute" aria-hidden="true" />
          알림 설정
        </a>
      </div>

      <div className="flex-1" />

      {/* footer — 다크모드 토글 + 공지 벨 (PCDock에서 이관) */}
      <div className="mt-2 flex items-center gap-2 border-t border-line px-1 pt-3">
        <button
          type="button"
          title={darkMode ? '라이트 모드로' : '다크 모드로'}
          onClick={toggleDarkMode}
          className="pressable flex h-9 w-9 flex-none items-center justify-center rounded-button bg-surface text-ink-2 shadow-pill"
        >
          {darkMode ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
        <button
          ref={bellRef}
          type="button"
          title="공지사항"
          aria-haspopup="dialog"
          aria-expanded={noticesOpen}
          onClick={() => setNoticesOpen((v) => !v)}
          className={`pressable relative flex h-9 w-9 flex-none items-center justify-center rounded-button shadow-pill ${
            noticesOpen ? 'bg-ink text-white' : 'bg-accent text-white hover:opacity-90'
          }`}
        >
          <Bell size={17} aria-hidden="true" />
          {hasNotices && !noticesOpen && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-pill bg-imminent border border-surface-2"
            />
          )}
        </button>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-caption font-semibold text-ink-2">한국공학대</p>
          <p className="truncate text-micro font-semibold text-mute">TIP · 정왕</p>
        </div>
      </div>
      <NoticesPopover open={noticesOpen} onClose={() => setNoticesOpen(false)} anchorRef={bellRef} />
    </aside>
  )
}
