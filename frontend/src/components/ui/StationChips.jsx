/**
 * StationChips
 * 정류장/방향 선택에 사용하는 가로 스크롤 칩 리스트 컴포넌트.
 *
 * Props:
 *   items    {id, label}[]            칩 목록
 *   active   string                   활성 칩 id
 *   onChange (id) => void             칩 클릭 핸들러
 *   variant  'station' | 'direction'  스타일 변형 (예약, 현재 동일 처리)
 */
export default function StationChips({ items = [], active, onChange, variant = 'station' }) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto"
      data-variant={variant}
    >
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            aria-pressed={isActive}
            onClick={() => onChange(item.id)}
            className={[
              'inline-flex items-center justify-center',
              'h-[38px] px-4 rounded-pill',
              'text-label font-semibold whitespace-nowrap select-none',
              'transition-colors duration-press',
              isActive
                ? 'bg-accent-bg text-accent-ink'
                : 'bg-surface-2 text-ink-2',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
