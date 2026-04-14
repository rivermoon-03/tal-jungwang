import { useEffect, useState } from 'react'
import useAppStore from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import MobileTabBar from './components/layout/MobileTabBar'
import PCNavbar from './components/layout/PCNavbar'
import MainTab from './components/map/MainTab'
import SubwayTab from './components/subway/SubwayTab'
import TransitTab from './components/transit/TransitTab'
import MoreTab from './components/more/MoreTab'
import PWAInstallBanner from './components/layout/PWAInstallBanner'
import HeroTitleBar from './components/layout/HeroTitleBar'
import SummaryCard from './components/summary/SummaryCard'
import BottomDock from './components/layout/BottomDock'
import FavoritesPage from './pages/FavoritesPage'
import SchedulePage from './pages/SchedulePage'
import MorePage from './pages/MorePage'
import { useNotices } from './hooks/useMore'

// ── 해시 → 탭 매핑 (기존 호환) ──────────────────────────────────────────
const VALID_HASH_TABS = ['main', 'transit', 'subway', 'more']

function hashToTab(hash) {
  const id = hash.replace(/^#\/?/, '') || 'main'
  return VALID_HASH_TABS.includes(id) ? id : 'main'
}

// ── pathname → 페이지 매핑 ───────────────────────────────────────────────
function pathnameToPage(pathname) {
  if (pathname.startsWith('/favorites')) return 'favorites'
  if (pathname.startsWith('/schedule'))  return 'schedule'
  if (pathname.startsWith('/more'))      return 'more-page'
  return null // null = 해시 라우팅으로 처리
}

export default function App() {
  const activeTab     = useAppStore((s) => s.activeTab)
  const setActiveTab  = useAppStore((s) => s.setActiveTab)
  const headerCollapsed = useAppStore((s) => s.headerCollapsed)
  const setTabBadges  = useAppStore((s) => s.setTabBadges)

  // 테마 훅 — 다크모드 클래스 + theme-color 동기화
  useTheme({ headerCollapsed })

  const { data: notices } = useNotices()

  // pathname 기반 페이지 (BottomDock의 새 라우트)
  const [currentPage, setCurrentPage] = useState(
    () => pathnameToPage(window.location.pathname)
  )

  const [nextArrival, setNextArrival] = useState(null)

  useEffect(() => {
    setTabBadges({ more: Array.isArray(notices) && notices.length > 0 })
  }, [notices, setTabBadges])

  // 기존 해시 라우팅 초기화
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
      if (!page) setActiveTab(hashToTab(window.location.hash))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveTab])

  // 해시 라우팅 동기화 (pathname 페이지가 없을 때만)
  useEffect(() => {
    if (currentPage) return
    const current = hashToTab(window.location.hash)
    if (current !== activeTab) {
      history.pushState(null, '', `#${activeTab}`)
    }
  }, [activeTab, currentPage])

  const isMainRoute = !currentPage

  // ── pathname 기반 페이지 렌더링 ─────────────────────────────────────
  if (currentPage === 'favorites') {
    return (
      <div className="flex flex-col h-dvh bg-[#fafafa] dark:bg-bg-soft transition-colors duration-300">
        <PWAInstallBanner />
        <main className="flex-1 overflow-auto min-h-0">
          <FavoritesPage />
        </main>
        <BottomDock />
      </div>
    )
  }

  if (currentPage === 'schedule') {
    return (
      <div className="flex flex-col h-dvh bg-[#fafafa] dark:bg-bg-soft transition-colors duration-300">
        <PWAInstallBanner />
        <main className="flex-1 overflow-auto min-h-0">
          <SchedulePage />
        </main>
        <BottomDock />
      </div>
    )
  }

  if (currentPage === 'more-page') {
    return (
      <div className="flex flex-col h-dvh bg-[#fafafa] dark:bg-bg-soft transition-colors duration-300">
        <PWAInstallBanner />
        <main className="flex-1 overflow-auto min-h-0">
          <MorePage />
        </main>
        <BottomDock />
      </div>
    )
  }

  // ── 기존 해시 라우팅 레이아웃 ───────────────────────────────────────
  return (
    <div className="flex flex-col h-dvh bg-[#fafafa] dark:bg-bg-soft transition-colors duration-300">
      {/* PWA 설치 배너 — 최상단 고정 */}
      <PWAInstallBanner />

      {/* PC 네비게이션 */}
      <div className="hidden md:block">
        <PCNavbar />
      </div>

      <main className="flex-1 overflow-hidden min-h-0 relative">
        <div className={`h-full ${activeTab === 'main' ? '' : 'hidden'}`}>
          <MainTab />
          {/* Hero + Summary — 지도 위 플로팅 오버레이 (모바일 전용) */}
          {isMainRoute && (
            <div className="md:hidden absolute inset-x-0 top-0 z-30 pointer-events-none">
              <div className="pointer-events-auto">
                <HeroTitleBar nextArrival={nextArrival} />
                <SummaryCard onNextArrivalChange={setNextArrival} />
              </div>
            </div>
          )}
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

      {/* 하단 독 (모바일) — 새 4탭 구조 */}
      <BottomDock />

      {/* 기존 MobileTabBar (숨김 처리 — BottomDock으로 대체됨) */}
      {/* 하위 호환 유지가 필요하다면 아래 주석 해제
      <div className="md:hidden">
        <MobileTabBar />
      </div>
      */}
    </div>
  )
}
