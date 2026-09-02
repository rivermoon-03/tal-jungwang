/**
 * 학식 메뉴 판정 헬퍼.
 *
 * 컴포넌트 파일에서 분리해 둔다 — 컴포넌트와 일반 함수를 한 파일에서 함께
 * export하면 fast refresh가 동작하지 않는다.
 */

/** 빈 메뉴 여부 판정 — 빈 배열 또는 ["미운영"] 단독 */
export function isEmptyMenu(items) {
  if (!items || items.length === 0) return true
  if (items.length === 1 && items[0] === '미운영') return true
  return false
}

// 학교 원본(PDF/xlsx)에서 그대로 온 메타 표기 — 별표로 감싼 안내문("*복수메뉴*" 등)은
// 메뉴 이름이 아니라 학교 쪽 주석이다. 복수메뉴 여부 자체는 hasMultipleMenuChoice가
// 실제 메뉴 항목의 "/" 유무로 이미 판정하므로 이 항목을 남겨 둘 이유가 없다 —
// 남겨 두면 브리핑/태그 화면에 별표째 그대로 찍힌다(결함 #9).
const META_MARKUP_RE = /^\*.*\*$/

/**
 * by_day 원본 항목 배열에서 실제 메뉴만 남긴다 — 별표 메타 표기 같은 학교 쪽
 * 안내문을 걷어낸다. 브리핑(homeBriefing.js)과 학식 화면(MealGridSection)이
 * 이 함수 하나를 같이 써야, 한쪽만 고쳐 표기가 어긋나는 일이 없다.
 *
 * @param {string[]|undefined|null} items
 * @returns {string[]}
 */
export function normalizeMenuItems(items) {
  return (items ?? []).filter((item) => item && !META_MARKUP_RE.test(item))
}

/** 메뉴 태그 칩 최대 표시 개수 — 넘으면 "+N"으로 뭉친다(시안 규격). */
export const MENU_TAG_LIMIT = 6

// 코너 표기 감지: "①코너 김치볶음밥&계란후라이" 처럼 원문자+코너로 시작하는
// 항목. 백엔드가 코너 개수를 별도 필드로 내려주지 않아, 실제 메뉴 항목
// 텍스트에서 세는 것만 신뢰한다 — 지어낸 값이 아니라 항상 실제 by_day에서
// 유도한다.
const CORNER_PREFIX_RE = /^([①-⑨])\s*코너/

/**
 * 복수메뉴(선택지) 여부 — 메뉴 항목 안에 "/"로 구분된 선택지가 있으면 true.
 * 예: "에비동/제육볶음면" → 둘 중 하나를 고르는 복수메뉴.
 *
 * @param {string[]} menuItems
 * @returns {boolean}
 */
export function hasMultipleMenuChoice(menuItems) {
  return (menuItems ?? []).some((item) => item.includes('/'))
}

/**
 * "HH:MM~HH:MM" 형식의 meal.time을 [시작, 종료]로 분리한다. 형식이 다르거나
 * 값이 없으면 null.
 *
 * @param {string|undefined} time
 * @returns {[string, string]|null}
 */
export function parseMealTimeRange(time) {
  if (!time) return null
  const [start, end] = String(time).split('~').map((s) => s.trim())
  if (!start || !end) return null
  return [start, end]
}

/**
 * 끼니 카드 하단(점선 구분 아래) 부가정보 계산.
 *
 * 좌측: 실제 메뉴 항목에서 셀 수 있는 사실만 쓴다 — "무제한 리필"처럼
 * 백엔드가 내려주지 않는 문구는 지어내지 않는다. 코너 표기가 있으면 코너
 * 개수, 없으면 메뉴 가짓수를 보여준다.
 * 우측: 지금 운영 중이면 오늘 종료 시각, 아니면 내일 같은 시각 재개 안내.
 * meal.time을 파싱하지 못하면 null(생략)한다.
 *
 * @param {{ time?: string }} meal
 * @param {string[]} menuItems
 * @param {boolean} isNowOpen
 * @returns {{ left: string, right: string|null }}
 */
export function getMealFooterInfo(meal, menuItems, isNowOpen) {
  const cornerNumbers = new Set(
    (menuItems ?? [])
      .map((item) => item.match(CORNER_PREFIX_RE)?.[1])
      .filter(Boolean)
  )

  const left = cornerNumbers.size > 0
    ? `코너 ${cornerNumbers.size}곳 운영`
    : `메뉴 ${menuItems.length}가지`

  const range = parseMealTimeRange(meal.time)
  const right = !range
    ? null
    : isNowOpen
      ? `${range[1]} 종료`
      : `내일 ${range[0]} 재개`

  return { left, right }
}
