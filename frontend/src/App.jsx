import { Suspense, useEffect } from 'react'
import useAppStore from './stores/useAppStore'
import { useTheme } from './hooks/useTheme'
import { useFontScale } from './hooks/useFontScale'
import { navigate, useLocation } from './lib/nav'
import AppShell from './components/shell/AppShell'
import PWAInstallBanner from './components/layout/PWAInstallBanner'
import HomePage from './components/home/HomePage'
import { lazyWithReload } from './utils/lazyWithReload'

// 첫 화면(홈)만 바로 싣고 나머지 탭은 들어갈 때 받는다.
const TransitPage = lazyWithReload(() => import('./components/transit/TransitPage'))
const BusRoutePage = lazyWithReload(() => import('./components/transit/BusRoutePage'))
const SubwayTimetablePage = lazyWithReload(() =>
  import('./components/transit/TimetablePages').then((m) => ({ default: m.SubwayTimetablePage })),
)
const ShuttleTimetablePage = lazyWithReload(() =>
  import('./components/transit/TimetablePages').then((m) => ({ default: m.ShuttleTimetablePage })),
)
const SchoolFoodPage = lazyWithReload(() => import('./components/meal/SchoolFoodPage'))
const MealVenuePage = lazyWithReload(() => import('./components/meal/MealVenuePage'))
const MorePage = lazyWithReload(() => import('./pages/MorePage'))
const NoticesTabPage = lazyWithReload(() => import('./pages/NoticesTabPage'))
const PrivacyPage = lazyWithReload(() => import('./pages/PrivacyPage'))

// 옛 주소. 북마크, 위젯 딥링크가 아직 쓴다.
const LEGACY = [
  [/^\/schedule/, '/transit'],
  [/^\/route\//, '/transit'],
  [/^\/facilities/, '/cafeteria'],
  [/^\/favorites/, '/'],
]

function legacyTarget(pathname) {
  return LEGACY.find(([re]) => re.test(pathname))?.[1] ?? null
}

function decode(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function Page({ pathname, query }) {
  if (pathname === '/') return <HomePage />
  if (pathname === '/transit') return <TransitPage />
  if (pathname.startsWith('/transit/bus/')) {
    return <BusRoutePage route={decode(pathname.slice('/transit/bus/'.length))} stop={query.get('stop')} view={query.get('view')} />
  }
  if (pathname === '/transit/subway/timetable') return <SubwayTimetablePage dirKey={query.get('key')} />
  if (pathname === '/transit/shuttle/timetable') return <ShuttleTimetablePage dir={Number(query.get('dir') ?? 1)} />
  if (pathname === '/cafeteria') return <SchoolFoodPage />
  if (pathname.startsWith('/cafeteria/')) return <MealVenuePage venueId={decode(pathname.slice('/cafeteria/'.length))} />
  if (pathname.startsWith('/more')) return <MorePage />
  if (pathname.startsWith('/notices')) return <NoticesTabPage />
  if (pathname.startsWith('/privacy')) return <PrivacyPage />
  return <HomePage />
}

export default function App() {
  const { pathname, query } = useLocation()
  useTheme()
  useFontScale()

  const legacy = legacyTarget(pathname)
  useEffect(() => {
    if (legacy) navigate(legacy, { replace: true })
  }, [legacy])

  // PWA 숏컷 등교, 하교 모드(?commute=up|down). 세션 동안만 방향을 고정하고 쿼리는 지운다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const commute = params.get('commute')
    if (commute !== 'up' && commute !== 'down') return
    useAppStore.getState().setDirectionOverride(commute === 'up' ? '등교' : '하교')
    params.delete('commute')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [])

  return (
    <AppShell>
      <PWAInstallBanner />
      <Suspense fallback={null}>
        <Page pathname={legacy ?? pathname} query={query} />
      </Suspense>
    </AppShell>
  )
}
