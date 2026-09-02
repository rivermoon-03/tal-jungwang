import { isEmptyMenu, MENU_TAG_LIMIT, hasMultipleMenuChoice, getMealFooterInfo, normalizeMenuItems } from './mealMenu'
import NowBadge from './NowBadge'

/**
 * 학식 끼니 카드.
 *
 * 시안 반영: 메뉴 항목은 격자 타일이 아니라 태그 칩(rounded-pill)이다 —
 * 예전에는 앞의 두 항목을 by_day 순서만 보고 "대표메뉴"로 강조했는데, 백엔드
 * 스키마가 순서를 보장하지 않아 "김치"·"단무지" 같은 반찬이 대표로 뜨는
 * 일이 있었다. 지금은 순서에 의미를 주지 않고 모든 항목을 같은 무게로
 * 태그로 나열한다.
 *
 * "지금 운영중" 배지 + 액센트 링은 showLiveStatus가 true일 때만(=오늘을
 * 보고 있을 때만) 계산한다. 다른 요일을 넘겨보는 중에 오늘 기준 실시간
 * 상태가 붙으면 거짓말이 된다(FacilitiesPage의 기존 규칙과 동일).
 *
 * @param {object} meal
 * @param {string} dayKey
 * @param {boolean} [isNowOpen] — 지금(현재 시각) 이 끼니가 운영 중인지
 * @param {boolean} [showLiveStatus] — 오늘을 보고 있어 실시간 상태를 보여줘도 되는지
 * @param {boolean} [compact] — 다른 식당 미리보기용 축약 카드(태그 3개, 부가정보 없음)
 */
export default function MealGridSection({
  meal,
  dayKey,
  isNowOpen = false,
  showLiveStatus = false,
  compact = false,
}) {
  // 별표 메타 표기("*복수메뉴*" 등 학교 쪽 안내문)를 먼저 걷어낸 뒤 빈 메뉴를
  // 판정한다 — 메타 항목만 있고 실제 메뉴가 없는 날을 "메뉴 있음"으로 잘못
  // 보여주지 않기 위해서다.
  const rawItems = normalizeMenuItems(meal.by_day?.[dayKey])
  const empty = isEmptyMenu(rawItems)
  const menuItems = empty ? [] : rawItems

  const tagLimit = compact ? 3 : MENU_TAG_LIMIT
  const shownItems = menuItems.slice(0, tagLimit)
  const overflow = menuItems.length - shownItems.length

  const showMultiTag = !compact && !empty && hasMultipleMenuChoice(menuItems)
  const footer = !compact && !empty && showLiveStatus
    ? getMealFooterInfo(meal, menuItems, isNowOpen)
    : null

  return (
    <div
      className={[
        'relative rounded-card bg-surface',
        'shadow-sh-card dark:bg-surface dark:border dark:border-line dark:shadow-none',
        compact ? 'p-3' : 'p-[18px]',
      ].join(' ')}
      // 지금 운영중인 끼니만 액센트 링(2px)을 두른다 — 카드 자체의 은은한
      // shadow-sh-card를 대체한다(테두리+그림자를 동시에 쌓지 않는다).
      style={!compact && isNowOpen ? { boxShadow: '0 0 0 2px var(--tj-accent)' } : undefined}
    >
      {/* "지금 운영중" 배지 — 카드 상단 경계에 걸치도록 절대배치한다. */}
      {!compact && isNowOpen && (
        <span className="absolute -top-3 left-4">
          <NowBadge />
        </span>
      )}

      {/* 헤더: 끼니 이름 + 시간 (+ 복수메뉴 표시 + 실시간 상태 pill) */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={[
            'font-bold text-ink leading-tight',
            compact ? 'text-list-nm' : 'text-eta-sm',
          ].join(' ')}
        >
          {meal.type}
        </span>
        {meal.time && (
          <span className="text-caption text-mute">{meal.time}</span>
        )}
        {showMultiTag && (
          <span className="text-caption text-mute">· 복수메뉴</span>
        )}
        {!compact && showLiveStatus && (
          <span
            className={[
              'ml-auto px-2 py-0.5 rounded-pill text-caption font-semibold whitespace-nowrap',
              isNowOpen
                ? 'bg-chip-green-bg text-chip-green-fg'
                : 'bg-chip-gray-bg text-chip-gray-fg',
            ].join(' ')}
          >
            {isNowOpen ? '영업 중' : '운영 종료'}
          </span>
        )}
      </div>

      {/* 메뉴 태그 칩 또는 미운영 안내 */}
      {empty ? (
        <p className="text-body text-mute py-2 mt-2">오늘은 운영하지 않아요</p>
      ) : (
        <div data-testid="menu-tags" className="mt-3 flex flex-wrap gap-1.5">
          {shownItems.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="text-caption font-semibold text-ink-2 bg-surface-2 rounded-pill px-2.5 py-1"
            >
              {item}
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-caption font-semibold text-mute bg-surface-2 rounded-pill px-2.5 py-1">
              +{overflow}
            </span>
          )}
        </div>
      )}

      {/* 하단 부가정보 — 점선 구분. 좌측은 실제 메뉴에서 셀 수 있는 사실만,
          우측은 오늘 종료/내일 재개 시각. */}
      {footer && (
        <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between gap-2 text-caption text-mute">
          <span>{footer.left}</span>
          {footer.right && <span>{footer.right}</span>}
        </div>
      )}
    </div>
  )
}
