/**
 * 2~3칸 세그먼트. options: [{ value, label, Icon?, disabled? }]
 */
export default function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`grid rounded-xl bg-surface-3 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ value: v, label: l, Icon, disabled }) => {
        const on = v === value
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-[9px] text-f15 transition-colors duration-150 ${
              on ? 'bg-surface font-extrabold text-ink shadow-sm' : 'font-bold text-ink-2'
            } disabled:text-mute-2`}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {l}
          </button>
        )
      })}
    </div>
  )
}
