/**
 * DayChips — 학식 요일 선택 칩 레일.
 *
 * 모바일(FacilitiesPage)과 PC(CafeteriaPCLayout)가 같은 마크업을 각자 복사해
 * 들고 있었다. 같은 것을 두 벌 고쳐야 하는 상태였고, 실제로 "오늘" 표시가
 * 양쪽 모두에 없었다.
 *
 * "오늘"과 "선택됨"은 독립된 두 신호다. 채움(배경)만으로 구분하면 다른 요일을
 * 넘겨보는 순간 오늘이 어디였는지 화면에서 사라진다 — 날짜를 이미 아는 사람만
 * 쓸 수 있는 UI가 된다.
 *
 * @param {{id:string,label:string,hasMenu:boolean,isToday:boolean}[]} items
 * @param {string} value      현재 선택된 날짜 키
 * @param {(id:string)=>void} onChange
 */
export default function DayChips({ items = [], value, onChange }) {
  if (!items.length) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto" role="group" aria-label="요일 선택">
      {items.map((item) => {
        const isActive = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            aria-current={item.isToday ? 'date' : undefined}
            data-has-menu={item.hasMenu ? 'true' : 'false'}
            data-today={item.isToday ? 'true' : undefined}
            onClick={() => onChange(item.id)}
            className={[
              'relative inline-flex items-center justify-center',
              'min-h-[44px] px-4 rounded-pill',
              'text-label font-semibold whitespace-nowrap select-none',
              'transition-colors duration-press',
              isActive
                ? 'bg-accent-bg text-accent-ink'
                : item.hasMenu
                  ? 'bg-surface-2 text-ink-2'
                  : 'bg-surface-2 text-ink-2 opacity-40',
            ].join(' ')}
          >
            {item.label}
            {item.isToday && (
              <>
                <span
                  aria-hidden="true"
                  className={[
                    'absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full',
                    isActive ? 'bg-accent-ink' : 'bg-imminent',
                  ].join(' ')}
                />
                <span className="sr-only"> · 오늘</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
