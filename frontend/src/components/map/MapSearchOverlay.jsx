import { Search } from 'lucide-react'

/**
 * MapSearchOverlay — PC 지도 좌상단에 얹는 플로팅 검색 + 필터 칩.
 *
 * 순수 프레젠테이셔널 컴포넌트. 데이터 패칭/스토어 접근 없음, props로만 동작한다.
 * 부모(PCMapDashboard 등)가 절대 위치 배치를 담당하고, 이 컴포넌트는 폭/내부 레이아웃만 잡는다.
 *
 * 참고: pc-mockup.html의 .map-search / .map-field / .chips 마크업을
 * 프로젝트 Tailwind + var(--tj-*) 토큰으로 옮긴 것.
 */
export default function MapSearchOverlay({
  value,
  onChange,
  onFocus,
  placeholder = '노선·정류장 검색',
  filters = [],
  onToggleFilter,
  className = '',
}) {
  return (
    <div className={`flex w-[min(320px,60%)] flex-col gap-[9px] ${className}`}>
      {/* 검색 필드 */}
      <div className="flex items-center gap-[10px] rounded-pill border border-line bg-surface px-4 py-[11px] shadow-pill">
        <span className="grid flex-none place-items-center text-mute">
          <Search size={16} />
        </span>
        <input
          type="text"
          aria-label={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-caption text-ink placeholder:text-mute focus:outline-none"
        />
      </div>

      {/* 필터 칩 */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-[7px]">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={!!filter.active}
              onClick={() => onToggleFilter?.(filter.id)}
              className={`pressable inline-flex min-h-[32px] items-center gap-[5px] rounded-pill border px-3 py-[6px] text-[12.5px] font-semibold shadow-pill transition-colors ${
                filter.active
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-surface text-ink-2'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
