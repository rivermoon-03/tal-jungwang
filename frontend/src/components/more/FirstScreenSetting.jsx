// frontend/src/components/more/FirstScreenSetting.jsx
import { ChevronLeft, Zap, Map } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const OPTIONS = [
  { id: 'now', label: '지금', desc: '실시간 출발 정보로 시작',   Icon: Zap },
  { id: 'map', label: '지도', desc: '지도와 정류장을 먼저 보기', Icon: Map },
]

export default function FirstScreenSetting({ onBack }) {
  const firstScreen = useAppStore((s) => s.firstScreen)
  const set         = useAppStore((s) => s.setFirstScreen)
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark">
      {/* header — DarkModePage와 통일 */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-border-dark flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft size={22} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">첫 화면</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-28 md:pb-6">
        {OPTIONS.map(({ id, label, desc, Icon }) => {
          const active = firstScreen === id
          return (
            <button
              key={id}
              onClick={() => set(id)}
              aria-pressed={active}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 dark:border-border-dark text-slate-900 dark:text-slate-100 bg-white dark:bg-surface-dark'
              }`}
            >
              <Icon size={20} strokeWidth={2} aria-hidden="true" />
              <div className="flex-1">
                <div className="text-sm font-bold">{label}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {desc}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
