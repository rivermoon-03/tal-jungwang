import { Map, Bus, TrainFront, MoreHorizontal, Moon, Sun } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '메인 지도', Icon: Map            },
  { id: 'transit', label: '교통',     Icon: Bus            },
  { id: 'subway',  label: '지하철',   Icon: TrainFront     },
  { id: 'more',    label: '더보기',   Icon: MoreHorizontal },
]

export default function PCNavbar() {
  const activeTab      = useAppStore((s) => s.activeTab)
  const setActiveTab   = useAppStore((s) => s.setActiveTab)
  const darkMode       = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  return (
    <header className="flex items-center gap-6 bg-navy text-white px-6 h-14 shrink-0">
      <div className="flex flex-col leading-tight mr-4">
        <span className="font-a2z text-xl font-bold">탈정왕</span>
      </div>
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
      <div className="flex-1" />
      <button
        aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        onClick={toggleDarkMode}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all pressable
          bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
      >
        {darkMode
          ? <Sun  size={16} strokeWidth={2} className="text-yellow-300" />
          : <Moon size={16} strokeWidth={2} />
        }
      </button>
    </header>
  )
}
