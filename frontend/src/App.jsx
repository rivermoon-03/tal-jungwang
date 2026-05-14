import { useEffect, useState } from 'react'
import useAppStore from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import PWAInstallBanner from './components/layout/PWAInstallBanner'
import MainShell from './components/layout/MainShell'
import PCMainShell from './components/layout/PCMainShell'
import Dashboard from './components/dashboard/Dashboard'
import PCMapDashboard from './components/dashboard/PCMapDashboard'
import FloatingDock from './components/common/FloatingDock'
import PCDock from './components/common/PCDock'
import SchedulePage from './pages/SchedulePage'
import CafeteriaPage from './pages/CafeteriaPage'
import MorePage from './pages/MorePage'
import GlobalDetailModal from './components/schedule/GlobalDetailModal'
import GlobalSubwayLineSheet from './components/subway/GlobalSubwayLineSheet'
import GlobalSubwayDetailSheet from './components/subway/GlobalSubwayDetailSheet'
import { useNotices } from './hooks/useMore'

const VALID_HASH_TABS = ['main', 'map', 'transit', 'subway', 'more']

function hashToTab(hash) {
  const id = hash.replace(/^#\/?/, '')
  if (!id) return 'map'
  return VALID_HASH_TABS.includes(id) ? id : 'map'
}

function pathnameToPage(pathname) {
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/cafeteria')) return 'cafeteria'
  if (pathname.startsWith('/more'))      return 'more-page'
  return null
}

export default function App() {
  const activeTab     = useAppStore((s) => s.activeTab)
  const setActiveTab  = useAppStore((s) => s.setActiveTab)
  const setTabBadges  = useAppStore((s) => s.setTabBadges)

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
      const initial = hashToTab(window.location.hash)
      if (initial !== activeTab) setActiveTab(initial)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = () => {
      const page = pathnameToPage(window.location.pathname)
      setCurrentPage(page)
      if (!page) {
        setActiveTab(hashToTab(window.location.hash))
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveTab])

  useEffect(() => {
    if (currentPage) return
    const current = hashToTab(window.location.hash)
    if (current !== activeTab) {
      history.pushState(null, '', `#${activeTab}`)
    }
  }, [activeTab, currentPage])

  // 좌측 패널 (PC) / 메인 본문 (모바일)에 들어갈 페이지 콘텐츠
  let pageContent
  let mobileContent
  if (currentPage === 'schedule') {
    pageContent = <SchedulePage />
    mobileContent = <SchedulePage />
  } else if (currentPage === 'cafeteria') {
    pageContent = <CafeteriaPage />
    mobileContent = <CafeteriaPage />
  } else if (currentPage === 'more-page') {
    pageContent = <MorePage />
    mobileContent = <MorePage />
  } else {
    // 지도(기본) 페이지 — PC 좌측에는 PCMapDashboard (2-row 분할: 버스 + 셔틀/지하철),
    // 모바일에는 MainShell (2단 스냅 + 모드 탭 Dashboard)
    pageContent = <PCMapDashboard />
    mobileContent = <MainShell />
  }

  return (
    <>
      <div className="flex flex-col h-dvh bg-bg dark:bg-bg-dark transition-colors duration-snap ease-ios">
        <PWAInstallBanner />

        <main className="flex-1 overflow-hidden min-h-0 relative">
          {/* 모바일 (≤ md) */}
          <div className="md:hidden h-full overflow-auto">
            {mobileContent}
          </div>

          {/* PC (≥ md): Tesla MCU — 좌 패널 + 우 영구 지도 */}
          <div className="hidden md:block h-full">
            <PCMainShell>{pageContent}</PCMainShell>
          </div>
        </main>

        {/* 모바일 floating dock (md:hidden 내부 처리) */}
        <FloatingDock />

        {/* PC 풀너비 검정 dock (hidden md:flex 내부 처리) */}
        <PCDock />
      </div>
      <GlobalDetailModal />
      <GlobalSubwayLineSheet />
      <GlobalSubwayDetailSheet />
    </>
  )
}
