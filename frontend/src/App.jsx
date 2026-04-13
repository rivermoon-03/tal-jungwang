import useAppStore from './stores/useAppStore'
import MobileTabBar from './components/layout/MobileTabBar'
import PCNavbar from './components/layout/PCNavbar'
import MainTab from './components/map/MainTab'
import ShuttleTab from './components/shuttle/ShuttleTab'
import BusTab from './components/bus/BusTab'
import SubwayTab from './components/subway/SubwayTab'

const TAB_CONTENT = {
  main:    <MainTab />,
  shuttle: <ShuttleTab />,
  bus:     <BusTab />,
  subway:  <SubwayTab />,
}

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab)

  return (
    <div className="flex flex-col h-dvh bg-slate-50">
      {/* PC navbar — hidden on mobile */}
      <div className="hidden md:block">
        <PCNavbar />
      </div>

      {/* Main area — overflow-hidden: 각 탭이 자체 스크롤 처리 */}
      <main key={activeTab} className="flex-1 overflow-hidden animate-fade-in min-h-0">
        {TAB_CONTENT[activeTab] ?? TAB_CONTENT.main}
      </main>

      {/* Mobile tab bar — hidden on PC */}
      <div className="md:hidden">
        <MobileTabBar />
      </div>
    </div>
  )
}
