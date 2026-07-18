/**
 * 빈 메뉴 여부 판정 — 빈 배열 또는 ["미운영"] 단독
 */
export function isEmptyMenu(items) {
  if (!items || items.length === 0) return true
  if (items.length === 1 && items[0] === '미운영') return true
  return false
}

/**
 * 시안1: 카드 그리드 메뉴 섹션
 * 메인 메뉴(앞 2개)는 강조 타일, 나머지는 일반 타일
 *
 * @param {object} meal
 * @param {string} dayKey
 * @param {import('react').ReactNode} [badge] — 헤더 우측에 붙는 보조 노드
 *   (예: PC 레이아웃의 "지금" pill). 지정하지 않으면 기존 마크업과 동일하다.
 */
export default function MealGridSection({ meal, dayKey, badge = null }) {
  const rawItems = meal.by_day?.[dayKey] ?? []
  const empty = isEmptyMenu(rawItems)
  const menuItems = empty ? [] : rawItems

  return (
    <div className="mb-5">
      {/* 섹션 헤더: type + time (+ 선택적 badge) */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[17px] font-semibold text-ink leading-tight">
          {meal.type}
        </span>
        {meal.time && (
          <span className="text-[13px] text-mute">{meal.time}</span>
        )}
        {badge}
      </div>

      {/* 빈 상태 */}
      {empty ? (
        <p className="text-body text-mute py-2">오늘은 운영하지 않아요</p>
      ) : (
        <div
          data-testid="menu-grid"
          className="grid grid-cols-2 gap-[10px]"
        >
          {menuItems.map((item, i) => {
            const isMain = i < 2
            return (
              <div
                key={`${item}-${i}`}
                className={[
                  'rounded-card px-[14px] py-4 flex items-center min-h-[64px]',
                  isMain
                    ? 'bg-accent-bg border border-accent-bg'
                    : 'bg-surface border border-line',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-[16px] leading-snug',
                    isMain
                      ? 'font-semibold text-accent'
                      : 'font-semibold text-ink',
                  ].join(' ')}
                >
                  {item}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
