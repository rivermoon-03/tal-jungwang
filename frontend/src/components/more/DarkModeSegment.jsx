/**
 * DarkModeSegment — 3-segment pill: 라이트 · 시스템 · 다크
 * Reads/writes themeMode from useAppStore.
 */
import { Sun, Monitor, Moon } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const SEGMENTS = [
  { id: 'light',  label: '라이트', Icon: Sun     },
  { id: 'system', label: '시스템', Icon: Monitor },
  { id: 'dark',   label: '다크',   Icon: Moon    },
]

export default function DarkModeSegment() {
  const themeMode = useAppStore((s) => s.themeMode)
  const setThemeMode = useAppStore((s) => s.setThemeMode)

  return (
    <div
      className="flex bg-surface-2 dark:bg-surface-dark rounded-full p-1 gap-1"
      role="group"
      aria-label="다크모드 설정"
    >
      {SEGMENTS.map(({ id, label, Icon }) => {
        const active = themeMode === id
        return (
          <button
            key={id}
            onClick={() => setThemeMode(id)}
            aria-pressed={active}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all pressable
              ${active
                ? 'shadow-sm text-white'
                : 'text-ink-2 dark:text-mute-dark hover:text-ink dark:hover:text-ink-dark'
              }`}
            style={{
              transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
              ...(active ? { background: 'var(--tj-accent)' } : {}),
            }}
          >
            <Icon size={13} color={active ? '#FFFFFF' : undefined} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
