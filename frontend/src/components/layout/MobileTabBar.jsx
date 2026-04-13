import { Map, Bus, BusFront, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '지도',   Icon: Map       },
  { id: 'shuttle', label: '셔틀',   Icon: Bus        },
  { id: 'bus',     label: '버스',   Icon: BusFront   },
  { id: 'subway',  label: '지하철', Icon: TrainFront },
]

export default function MobileTabBar() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const sheetOpen    = useAppStore((s) => s.sheetOpen)

  return (
    <nav
      className={`fixed left-1/2 -translate-x-1/2 z-50
        flex items-center gap-1
        bg-white/90 backdrop-blur-xl
        rounded-full px-2 py-2
        shadow-2xl shadow-black/20
        border border-slate-100/80
        transition-all duration-300 ease-out
        ${sheetOpen
          ? 'opacity-0 scale-90 pointer-events-none'
          : 'opacity-100 scale-100'
        }`}
      style={{ bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-all pressable
              ${active
                ? 'bg-navy text-white shadow-md'
                : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            <Icon size={24} strokeWidth={active ? 2.2 : 1.8} />
          </button>
        )
      })}
    </nav>
  )
}
