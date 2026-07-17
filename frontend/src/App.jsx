import { lazy, Suspense, useEffect, useState } from 'react'
import useAppStore from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import PWAInstallBanner from './components/layout/PWAInstallBanner'
import MainShell from './components/layout/MainShell'
import PCMainShell from './components/layout/PCMainShell'
import Dashboard from './components/dashboard/Dashboard'
import PCMapDashboard from './components/dashboard/PCMapDashboard'
import { useIsDesktop } from './hooks/useMediaQuery'
import FloatingDock from './components/common/FloatingDock'
import PCDock from './components/common/PCDock'
import GlobalDetailModal from './components/schedule/GlobalDetailModal'
import GlobalSubwayLineSheet from './components/subway/GlobalSubwayLineSheet'
import GlobalSubwayDetailSheet from './components/subway/GlobalSubwayDetailSheet'
import { useNotices } from './hooks/useMore'

// 지도 외 페이지는 진입 시에만 로드 — 초기 번들에서 분리한다.
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const CafeteriaPage = lazy(() => import('./pages/CafeteriaPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const RouteDetailPage = lazy(() => import('./pages/RouteDetailPage'))
const CafeteriaVenueDetailPage = lazy(() => import('./pages/CafeteriaVenueDetailPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))

const VALID_HASH_TABS = ['main', 'map', 'transit', 'subway', 'more']

function hashToTab(hash) {
  const id = hash.replace(/^#\/?/, '')
  if (!id) return 'map'
  return VALID_HASH_TABS.includes(id) ? id : 'map'
}

function pathnameToPage(pathname) {
  if (pathname.startsWith('/privacy'))    return 'privacy'
  if (pathname.startsWith('/schedule'))   return 'schedule'
  // /cafeteria/:id (상세)와 /cafeteria (탭) 구분
  if (pathname.startsWith('/cafeteria/')) return 'cafeteria-venue'
  if (pathname === '/cafeteria')          return 'cafeteria'
  if (pathname.startsWith('/more'))       return 'more-page'
  if (pathname.startsWith('/route/'))     return 'route-detail'
  return null
}

/**
 * /cafeteria/student-cafeteria → "student-cafeteria"
 * decodeURIComponent 적용.
 */
function parseVenueId(pathname) {
  const raw = pathname.replace(/^\/cafeteria\//, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * /route/bus:33 → "33", /route/33 → "33"
 * prefix bus: 또는 숫자만 지원. 추후 subway: 등 확장 가능.
 */
function parseRouteId(pathname) {
  const raw = pathname.replace(/^\/route\//, '')
  // 한글 노선명(예: "시흥33")은 URL에서 %EC..로 인코딩되므로 디코딩한다.
  let segment
  try {
    segment = decodeURIComponent(raw)
  } catch {
    segment = raw
  }
  if (segment.startsWith('bus:')) return segment.slice(4)
  return segment
}

/**
 * /route/bus:5602?stop=시흥시청 → "시흥시청"
 * decodeURIComponent 적용. 없으면 null.
 */
function parseStopQuery(search) {
  try {
    const params = new URLSearchParams(search)
    const raw = params.get('stop')
    if (!raw) return null
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

export default function App() {
  const activeTab     = useAppStore((s) => s.activeTab)
  const setActiveTab  = useAppStore((s) => s.setActiveTab)
  const setTabBadges  = useAppStore((s) => s.setTabBadges)

  const isDesktop = useIsDesktop()

  useTheme()

  const { data: notices } = useNotices()

  const [currentPage, setCurrentPage] = useState(
    () => pathnameToPage(window.location.pathname)
  )
  const [routeNumber, setRouteNumber] = useState(
    () => pathnameToPage(window.location.pathname) === 'route-detail'
      ? parseRouteId(window.location.pathname)
      : null
  )
  const [routeStop, setRouteStop] = useState(
    () => pathnameToPage(window.location.pathname) === 'route-detail'
      ? parseStopQuery(window.location.search)
      : null
  )
  const [venueId, setVenueId] = useState(
    () => pathnameToPage(window.location.pathname) === 'cafeteria-venue'
      ? parseVenueId(window.location.pathname)
      : null
  )

  useEffect(() => {
    setTabBadges({ more: Array.isArray(notices) && notices.length > 0 })
  }, [notices, setTabBadges])

  useEffect(() => {
    const page = pathnameToPage(window.location.pathname)
    setCurrentPage(page)
    if (page === 'route-detail') {
      setRouteNumber(parseRouteId(window.location.pathname))
      setRouteStop(parseStopQuery(window.location.search))
    }
    if (page === 'cafeteria-venue') {
      setVenueId(parseVenueId(window.location.pathname))
    }
    if (!page) {
      const initial = hashToTab(window.location.hash)
      if (initial !== activeTab) setActiveTab(initial)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = () => {
      const page = pathnameToPage(window.location.pathname)
      setCurrentPage(page)
      if (page === 'route-detail') {
        setRouteNumber(parseRouteId(window.location.pathname))
        setRouteStop(parseStopQuery(window.location.search))
      }
      if (page === 'cafeteria-venue') {
        setVenueId(parseVenueId(window.location.pathname))
      }
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
  } else if (currentPage === 'privacy') {
    pageContent = <PrivacyPage />
    mobileContent = <PrivacyPage />
  } else if (currentPage === 'route-detail') {
    pageContent = <RouteDetailPage routeNumber={routeNumber} stop={routeStop} />
    mobileContent = <RouteDetailPage routeNumber={routeNumber} stop={routeStop} />
  } else if (currentPage === 'cafeteria-venue') {
    pageContent = <CafeteriaVenueDetailPage venueId={venueId} />
    mobileContent = <CafeteriaVenueDetailPage venueId={venueId} />
  } else {
    // 지도(기본) 페이지 — PC 좌측에는 PCMapDashboard (2-row 분할: 버스 + 셔틀/지하철),
    // 모바일에는 MainShell (2단 스냅 + 모드 탭 Dashboard)
    pageContent = <PCMapDashboard />
    mobileContent = <MainShell />
  }

  return (
    <>
      <div className="flex flex-col h-dvh bg-bg dark:bg-bg transition-colors duration-snap ease-inout">
        <PWAInstallBanner />

        <main className="flex-1 overflow-hidden min-h-0 relative">
          {/* 모바일 ↔ PC 레이아웃을 JS 미디어쿼리로 분기.
              CSS hidden만 쓰면 양쪽이 동시에 마운트되어, 숨겨진 쪽의 useEffect가
              계속 돌면서 store를 덮어쓰는 부작용이 발생함 (PCStationPicker auto-sync 등). */}
          <Suspense fallback={<div className="h-full" />}>
            {isDesktop ? (
              <div key={currentPage ?? 'home'} className="h-full tj-tab-fade">
                {/* 지도 홈(currentPage=null)만 38%/62% 분할 + 영구 지도.
                    시간표·학식·더보기 등은 지도 없이 전체 폭(PC·시간표/설정 시안). */}
                <PCMainShell showMap={!currentPage}>{pageContent}</PCMainShell>
              </div>
            ) : (
              <div key={currentPage ?? 'home'} className="h-full overflow-auto tj-tab-fade">
                {mobileContent}
              </div>
            )}
          </Suspense>
        </main>

        {/* 모바일/PC 중 하나만 조건부 마운트 — CSS hidden만 쓰면 숨겨진 쪽의
            useWeather·useClock 등 훅이 계속 돌아 불필요한 부작용이 생긴다. */}
        {isDesktop ? <PCDock /> : <FloatingDock />}
      </div>
      <GlobalDetailModal />
      <GlobalSubwayLineSheet />
      <GlobalSubwayDetailSheet />
    </>
  )
}
