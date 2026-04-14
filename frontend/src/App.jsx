import { useEffect } from 'react'
import useAppStore from './stores/useAppStore'
import MobileTabBar from './components/layout/MobileTabBar'
import PCNavbar from './components/layout/PCNavbar'
import MainTab from './components/map/MainTab'
import SubwayTab from './components/subway/SubwayTab'
import TransitTab from './components/transit/TransitTab'
import MoreTab from './components/more/MoreTab'

const VALID_TABS = ['main', 'transit', 'subway', 'more']

function hashToTab(hash) {
  const id = hash.replace(/^#\/?/, '') || 'main'
  return VALID_TABS.includes(id) ? id : 'main'
}

export default function App() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const darkMode     = useAppStore((s) => s.darkMode)

  useEffect(() => {
    const initial = hashToTab(window.location.hash)
    if (initial !== activeTab) setActiveTab(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = () => setActiveTab(hashToTab(window.location.hash))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveTab])

  useEffect(() => {
    const current = hashToTab(window.location.hash)
    if (current !== activeTab) {
      history.pushState(null, '', `#${activeTab}`)
    }
  }, [activeTab])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="flex flex-col h-dvh bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="hidden md:block">
        <PCNavbar />
      </div>
      <main className="flex-1 overflow-hidden min-h-0">
        <div className={`h-full ${activeTab === 'main' ? '' : 'hidden'}`}>
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
      <div className="md:hidden">
        <MobileTabBar />
      </div>
    </div>
  )
}
