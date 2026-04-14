import { Map, Bus, TrainFront, MoreHorizontal, Locate, School } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '지도',   Icon: Map            },
  { id: 'transit', label: '교통',   Icon: Bus            },
  { id: 'subway',  label: '지하철', Icon: TrainFront     },
  { id: 'more',    label: '더보기', Icon: MoreHorizontal },
]

const DEFAULT_CENTER = { lat: 37.3400, lng: 126.7335 }

export default function MobileTabBar() {
  const activeTab       = useAppStore((s) => s.activeTab)
  const setActiveTab    = useAppStore((s) => s.setActiveTab)
  const sheetOpen       = useAppStore((s) => s.sheetOpen)
  const tabBadges       = useAppStore((s) => s.tabBadges)
  const userLocation    = useAppStore((s) => s.userLocation)
  const setMapPanTarget = useAppStore((s) => s.setMapPanTarget)

  const showMap = activeTab === 'main' && !sheetOpen

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
        transition-all duration-300 ease-out
        ${sheetOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
      style={{ bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
    >
      <button
        aria-label="내 위치로 이동"
        disabled={!userLocation}
        onClick={() => setMapPanTarget({ lat: userLocation.lat, lng: userLocation.lng })}
        className={`w-10 h-10 rounded-full
          bg-white/90 dark:bg-slate-700/90 backdrop-blur-md shadow-lg
          flex items-center justify-center pressable transition-all duration-200
          text-navy dark:text-blue-300
          ${showMap && userLocation
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 pointer-events-none'
          }`}
      >
        <Locate size={18} strokeWidth={2} />
      </button>

      <nav className="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-full px-2 py-2 shadow-2xl shadow-black/20 border border-slate-100/80 dark:border-slate-700/80">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          const hasBadge = tabBadges?.[id] === true
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all pressable
                ${active
                  ? 'bg-navy text-white shadow-md'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              <Icon size={24} strokeWidth={active ? 2.2 : 1.8} />
              {hasBadge && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-800" />
              )}
            </button>
          )
        })}
      </nav>

      <button
        aria-label="학교로 이동"
        onClick={() => setMapPanTarget(DEFAULT_CENTER)}
        className={`w-10 h-10 rounded-full
          bg-white/90 dark:bg-slate-700/90 backdrop-blur-md shadow-lg
          flex items-center justify-center pressable transition-all duration-200
          text-navy dark:text-blue-300
          ${showMap
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 pointer-events-none'
          }`}
      >
        <School size={18} strokeWidth={2} />
      </button>
    </div>
  )
}
