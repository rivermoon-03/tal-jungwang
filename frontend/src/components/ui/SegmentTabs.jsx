/**
 * SegmentTabs
 * 모드/방향 선택에 사용하는 세그먼트 탭 컴포넌트.
 *
 * Props:
 *   items    {id, label}[]  탭 목록
 *   active   string         활성 탭 id
 *   onChange (id) => void   탭 클릭 핸들러
 */
export default function SegmentTabs({ items = [], active, onChange }) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 bg-surface-2 rounded-btn p-1"
    >
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={[
              'flex-1 flex items-center justify-center',
              'min-h-[44px] px-3 rounded-badge',
              'text-label font-semibold select-none',
              'transition-colors duration-press',
              isActive
                ? 'bg-ink text-white dark:bg-accent dark:text-black'
                : 'bg-transparent text-ink-2',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
