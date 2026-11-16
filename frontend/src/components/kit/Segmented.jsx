/**
 * 2~3칸 세그먼트. options: [{ value, label, Icon?, disabled? }]
 * 선택 면은 칸 사이를 미끄러져 옮겨 간다(iOS 세그먼트와 같은 방식).
 */
export default function Segmented({ options, value, onChange, label, className = '' }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const n = options.length
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`relative grid rounded-xl bg-surface-3 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="tj-slide-thumb absolute bottom-1 left-1 top-1 rounded-[9px] bg-surface shadow-sm"
        style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
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
            className={`relative flex h-10 items-center justify-center gap-1.5 rounded-[9px] text-f15 transition-colors duration-150 ${
              on ? 'font-extrabold text-ink' : 'font-bold text-ink-2'
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
