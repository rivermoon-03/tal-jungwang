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
      className={`fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white transition-transform duration-300 ease-out ${
        sheetOpen ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ height: 76 }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 text-sm font-semibold
              border-t-2 transition-colors min-h-[56px] pressable
              ${active
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-400'
              }`}
          >
            <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
