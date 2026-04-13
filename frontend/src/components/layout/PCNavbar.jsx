import { Map, Bus, BusFront, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '메인 지도', Icon: Map       },
  { id: 'shuttle', label: '셔틀버스',  Icon: Bus        },
  { id: 'bus',     label: '버스',      Icon: BusFront   },
  { id: 'subway',  label: '지하철',    Icon: TrainFront },
]

export default function PCNavbar() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <header className="flex items-center gap-6 bg-navy text-white px-6 h-14 shrink-0">
      {/* 브랜드 */}
      <div className="flex flex-col leading-tight mr-4">
        <span className="font-a2z text-xl font-bold">탈정왕</span>
      </div>

      {/* 탭 */}
      <nav className="flex items-center gap-1">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 h-14 text-sm font-medium border-b-2 transition-colors
                ${active
                  ? 'text-white border-accent'
                  : 'text-white/55 border-transparent hover:text-white/80'
                }`}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
