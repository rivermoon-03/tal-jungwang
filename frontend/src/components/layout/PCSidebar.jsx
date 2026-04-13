import { Map, Bus, BusFront, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '메인 지도', Icon: Map       },
  { id: 'shuttle', label: '셔틀버스',  Icon: Bus        },
  { id: 'bus',     label: '버스',      Icon: BusFront   },
  { id: 'subway',  label: '지하철',    Icon: TrainFront },
]

export default function PCSidebar() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <aside
      className="flex flex-col bg-navy text-white"
      style={{ width: 240, minHeight: '100vh' }}
    >
      <div className="px-5 py-5 border-b border-white/10">
        <div className="font-a2z text-2xl font-bold leading-tight">탈정왕</div>
      </div>

      <nav className="flex-1 py-3">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 px-5 py-3 text-base font-medium
                border-r-4 transition-colors
                ${active
                  ? 'bg-white/10 text-white border-accent'
                  : 'text-white/55 border-transparent hover:bg-white/5'
                }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
