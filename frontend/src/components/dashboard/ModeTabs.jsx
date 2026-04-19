import useAppStore from '../../stores/useAppStore'

/**
 * ModeTabs — 버스 / 지하철 / 셔틀 세그먼트 pill.
 *
 * - 아이콘 없음, 텍스트만
 * - 선택: 라이트 bg-ink text-white / 다크 bg-accent-dark text-ink
 * - 비선택: 투명 + border 1px border-mute/40 text-mute
 * - role="tablist", 각 버튼 role="tab" + aria-selected
 *
 * 상태는 useAppStore.selectedMode / setSelectedMode를 사용한다.
 */
const MODES = [
  { value: 'bus',     label: '버스' },
  { value: 'subway',  label: '지하철' },
  { value: 'shuttle', label: '셔틀' },
]

export default function ModeTabs() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)

  return (
    <div
      role="tablist"
      aria-label="교통수단 선택"
      className="flex gap-2 px-4 pt-2 pb-1.5"
    >
      {MODES.map((m) => {
        const isActive = selectedMode === m.value
        const base =
          'px-4 py-2 rounded-full text-body transition-colors duration-press pressable'
        const active =
          'bg-ink text-white dark:bg-accent-dark dark:text-ink'
        const inactive =
          'bg-transparent border border-mute/40 text-mute dark:border-border-dark'
        return (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setSelectedMode(m.value)}
            className={`${base} ${isActive ? active : inactive}`}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
