import { useEffect } from 'react'
import useAppStore from './stores/useAppStore'
import MobileTabBar from './components/layout/MobileTabBar'
import PCNavbar from './components/layout/PCNavbar'
import MainTab from './components/map/MainTab'
import ShuttleTab from './components/shuttle/ShuttleTab'
import BusTab from './components/bus/BusTab'
import SubwayTab from './components/subway/SubwayTab'

const VALID_TABS = ['main', 'shuttle', 'bus', 'subway']

function hashToTab(hash) {
  const id = hash.replace(/^#\/?/, '') || 'main'
  return VALID_TABS.includes(id) ? id : 'main'
}

export default function App() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const darkMode     = useAppStore((s) => s.darkMode)

  // 초기 마운트: hash → 탭 동기화
  useEffect(() => {
    const initial = hashToTab(window.location.hash)
    if (initial !== activeTab) setActiveTab(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 브라우저 뒤로가기/앞으로가기 → 탭 동기화
  useEffect(() => {
    const onPop = () => setActiveTab(hashToTab(window.location.hash))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveTab])

  // 탭 변경 → URL hash 갱신 (pushState로 히스토리 쌓기)
  useEffect(() => {
    const current = hashToTab(window.location.hash)
    if (current !== activeTab) {
      history.pushState(null, '', `#${activeTab}`)
    }
  }, [activeTab])

  // html 엘리먼트에 dark 클래스 토글 — Tailwind dark: 유틸리티가 전역으로 동작
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="flex flex-col h-dvh bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* PC navbar — hidden on mobile */}
      <div className="hidden md:block">
        <PCNavbar />
      </div>

      {/* Main area */}
      <main className="flex-1 overflow-hidden min-h-0">
        {/* MainTab은 항상 마운트 유지 — InfoPanel 배지 계산·지도 상태 보존 */}
        <div className={`h-full ${activeTab === 'main' ? '' : 'hidden'}`}>
          <MainTab />
        </div>

        {activeTab === 'shuttle' && (
          <div key="shuttle" className="h-full overflow-hidden animate-fade-in">
            <ShuttleTab />
          </div>
        )}
        {activeTab === 'bus' && (
          <div key="bus" className="h-full overflow-hidden animate-fade-in">
            <BusTab />
          </div>
        )}
        {activeTab === 'subway' && (
          <div key="subway" className="h-full overflow-hidden animate-fade-in">
            <SubwayTab />
          </div>
        )}
      </main>

      {/* Mobile tab bar — hidden on PC */}
      <div className="md:hidden">
        <MobileTabBar />
      </div>
    </div>
  )
}
