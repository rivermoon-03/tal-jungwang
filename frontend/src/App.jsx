import { useEffect, useState } from 'react'
import useAppStore from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import PCNavbar from './components/layout/PCNavbar'
import MainTab from './components/map/MainTab'
import SubwayTab from './components/subway/SubwayTab'
import TransitTab from './components/transit/TransitTab'
import MoreTab from './components/more/MoreTab'
import NowTab from './components/now/NowTab'
import PWAInstallBanner from './components/layout/PWAInstallBanner'
import MainShell from './components/layout/MainShell'
import BottomDock from './components/layout/BottomDock'
import SchedulePage from './pages/SchedulePage'
import StatsPage from './pages/StatsPage'
import MorePage from './pages/MorePage'
import GlobalDetailModal from './components/schedule/GlobalDetailModal'
import { useNotices } from './hooks/useMore'

const VALID_HASH_TABS = ['now', 'main', 'map', 'transit', 'subway', 'more']

function hashToTab(hash, firstScreen = 'now') {
  const id = hash.replace(/^#\/?/, '')
  if (!id) return firstScreen === 'map' ? 'map' : 'now'
  return VALID_HASH_TABS.includes(id) ? id : 'now'
}

function pathnameToPage(pathname) {
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/stats'))     return 'stats'   // legacy — unreachable from dock
  if (pathname.startsWith('/more'))      return 'more-page'
  return null
}

// Some pathnames should force a specific activeTab (e.g. /map → 지도 탭)
function pathnameToTab(pathname) {
  if (pathname.startsWith('/map')) return 'map'
  return null
}

export default function App() {
  const activeTab     = useAppStore((s) => s.activeTab)
  const setActiveTab  = useAppStore((s) => s.setActiveTab)
  const setTabBadges  = useAppStore((s) => s.setTabBadges)
  const firstScreen   = useAppStore((s) => s.firstScreen)

  useTheme()

  const { data: notices } = useNotices()

  const [currentPage, setCurrentPage] = useState(
    () => pathnameToPage(window.location.pathname)
  )

  useEffect(() => {
    setTabBadges({ more: Array.isArray(notices) && notices.length > 0 })
  }, [notices, setTabBadges])

  useEffect(() => {
    const page = pathnameToPage(window.location.pathname)
    setCurrentPage(page)
    if (!page) {
      const forced = pathnameToTab(window.location.pathname)
      const initial = forced ?? hashToTab(window.location.hash, firstScreen)
      if (initial !== activeTab) setActiveTab(initial)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = () => {
      const page = pathnameToPage(window.location.pathname)
      setCurrentPage(page)
      if (!page) {
        const forced = pathnameToTab(window.location.pathname)
        setActiveTab(forced ?? hashToTab(window.location.hash, firstScreen))
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveTab, firstScreen])

  useEffect(() => {
    if (currentPage) return
    // Skip hash-sync when pathname pins the tab (/map).
    if (pathnameToTab(window.location.pathname)) return
    const current = hashToTab(window.location.hash, firstScreen)
    if (current !== activeTab) {
      history.pushState(null, '', `#${activeTab}`)
    }
  }, [activeTab, currentPage, firstScreen])

  if (currentPage === 'schedule') {
    return (
      <>
        <div className="flex flex-col h-dvh bg-white dark:bg-bg-dark transition-colors duration-snap ease-ios">
          <PWAInstallBanner />
          <div className="hidden md:block">
            <PCNavbar />
          </div>
          <main className="flex-1 overflow-auto min-h-0">
            <SchedulePage />
          </main>
          <BottomDock />
        </div>
        <GlobalDetailModal />
      </>
    )
  }

  if (currentPage === 'stats') {
    return (
      <>
        <div className="flex flex-col h-dvh bg-white dark:bg-bg-dark transition-colors duration-snap ease-ios">
          <PWAInstallBanner />
          <div className="hidden md:block">
            <PCNavbar />
          </div>
          <main className="flex-1 overflow-auto min-h-0">
            <StatsPage />
          </main>
          <BottomDock />
        </div>
        <GlobalDetailModal />
      </>
    )
  }

  if (currentPage === 'more-page') {
    return (
      <>
        <div className="flex flex-col h-dvh bg-white dark:bg-bg-dark transition-colors duration-snap ease-ios">
          <PWAInstallBanner />
          <div className="hidden md:block">
            <PCNavbar />
          </div>
          <main className="flex-1 overflow-auto min-h-0">
            <MorePage />
          </main>
          <BottomDock />
        </div>
        <GlobalDetailModal />
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col h-dvh bg-white dark:bg-bg-dark transition-colors duration-snap ease-ios">
        <PWAInstallBanner />

        <div className="hidden md:block">
          <PCNavbar />
        </div>

        <main className="flex-1 overflow-hidden min-h-0 relative">
          {/* 지금 탭 — 새 랜딩 */}
          {activeTab === 'now' && (
            <div key="now" className="h-full overflow-hidden animate-fade-in">
              <NowTab />
            </div>
          )}

          {/* 모바일: 2단 스냅 MainShell (activeTab=map 또는 레거시 main) */}
          {(activeTab === 'map' || activeTab === 'main') && <MainShell />}

          {/* PC: 기존 MainTab 유지 (md:block) */}
          <div
            className={`hidden md:block h-full ${
              activeTab === 'map' || activeTab === 'main' ? '' : 'md:hidden'
            }`}
          >
            <MainTab />
          </div>

          {activeTab === 'transit' && (
            <div key="transit" className="h-full overflow-hidden animate-fade-in">
              <TransitTab />
            </div>
          )}
          {activeTab === 'subway' && (
            <div key="subway" className="h-full overflow-hidden animate-fade-in">
              <SubwayTab />
            </div>
          )}
          {activeTab === 'more' && (
            <div key="more" className="h-full overflow-hidden animate-fade-in">
              <MoreTab />
            </div>
          )}
        </main>

        <BottomDock />
      </div>
      <GlobalDetailModal />
    </>
  )
}
