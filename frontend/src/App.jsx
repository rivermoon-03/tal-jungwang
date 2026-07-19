import { lazy, Suspense, useEffect, useState } from 'react'
import useAppStore from './stores/useAppStore'
import { hasReloadedForChunkError, markReloadedForChunkError, clearReloadGuard } from './utils/chunkReload'
import { useTheme } from './hooks/useTheme'
import { useFontScale } from './hooks/useFontScale'
import PWAInstallBanner from './components/layout/PWAInstallBanner'
import MainShell from './components/layout/MainShell'
import PCMainShell from './components/layout/PCMainShell'
import PCSidebar from './components/layout/PCSidebar'
import Dashboard from './components/dashboard/Dashboard'
import { useIsDesktop } from './hooks/useMediaQuery'
import FloatingDock from './components/common/FloatingDock'
import GlobalDetailModal from './components/schedule/GlobalDetailModal'
import GlobalSubwayLineSheet from './components/subway/GlobalSubwayLineSheet'
import GlobalSubwayDetailSheet from './components/subway/GlobalSubwayDetailSheet'
import SearchOverlay from './components/search/SearchOverlay'
import { useNotices } from './hooks/useMore'

// 배포 직후 스테일 청크(옛 해시 파일이 서버에서 사라진 경우) 복구용 가드.
// import 실패 시 세션당 1회만 새로고침하고, 그래도 실패하면 에러를 그대로 던진다(무한 루프 방지).
function lazyWithReload(importer) {
  return lazy(() =>
    importer()
      .then((mod) => {
        clearReloadGuard()
        return mod
      })
      .catch((err) => {
        if (!hasReloadedForChunkError()) {
          markReloadedForChunkError()
          window.location.reload()
          return new Promise(() => {}) // 리로드가 일어날 때까지 렌더를 보류한다
        }
        throw err
      })
  )
}

// 지도 외 페이지는 진입 시에만 로드 — 초기 번들에서 분리한다.
const SchedulePage = lazyWithReload(() => import('./pages/SchedulePage'))
const CafeteriaPage = lazyWithReload(() => import('./pages/CafeteriaPage'))
const MorePage = lazyWithReload(() => import('./pages/MorePage'))
const RouteDetailPage = lazyWithReload(() => import('./pages/RouteDetailPage'))
const CafeteriaVenueDetailPage = lazyWithReload(() => import('./pages/CafeteriaVenueDetailPage'))
const PrivacyPage = lazyWithReload(() => import('./pages/PrivacyPage'))

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
  useFontScale()

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
    // 지도(기본) 페이지 — PC는 PCMainShell이 children=null을 받아 풀사이즈 지도 +
    // 플로팅 검색/도착 카드로 직접 그린다(PCMapDashboard는 더 이상 쓰지 않음).
    // 모바일에는 MainShell (2단 스냅 + 모드 탭 Dashboard)
    pageContent = null
    mobileContent = <MainShell />
  }

  return (
    <>
      <div className={`h-dvh bg-bg dark:bg-bg transition-colors duration-snap ease-inout ${isDesktop ? 'flex' : 'flex flex-col'}`}>
        {/* 데스크톱: 좌측 반투명 사이드바(탭 네비/다크토글/공지벨을 이관받음, PCDock은
            더 이상 마운트하지 않는다) + 우측 지도/콘텐츠. 모바일: 기존 세로 스택. */}
        {isDesktop && <PCSidebar />}

        <div className="flex flex-1 min-w-0 flex-col">
          <PWAInstallBanner />

          <main className="flex-1 overflow-hidden min-h-0 relative">
            {/* 모바일 ↔ PC 레이아웃을 JS 미디어쿼리로 분기.
                CSS hidden만 쓰면 양쪽이 동시에 마운트되어, 숨겨진 쪽의 useEffect가
                계속 돌면서 store를 덮어쓰는 부작용이 발생함 (PCStationPicker auto-sync 등). */}
            <Suspense fallback={<div className="h-full" />}>
              {isDesktop ? (
                <div key={currentPage ?? 'home'} className="h-full tj-tab-fade">
                  {/* 지도 홈(currentPage=null)에서는 children=null → PCMainShell이
                      풀사이즈 지도 + 플로팅 오버레이를 직접 그린다. 그 외 페이지는
                      children으로 받은 pageContent가 지도 위 불투명 패널을 채운다. */}
                  <PCMainShell>{pageContent}</PCMainShell>
                </div>
              ) : (
                <div key={currentPage ?? 'home'} className="h-full overflow-auto tj-tab-fade">
                  {mobileContent}
                </div>
              )}
            </Suspense>
          </main>

          {/* 모바일만 하단 FloatingDock. 데스크톱 네비는 PCSidebar가 담당한다. */}
          {!isDesktop && <FloatingDock />}
        </div>
      </div>
      <GlobalDetailModal />
      <GlobalSubwayLineSheet />
      <GlobalSubwayDetailSheet />
      <SearchOverlay />
    </>
  )
}
