// Soft Tinted route chip — 카드 내부에서 노선 번호를 옅은 톤으로 표시.
// 지도 마커처럼 배경이 컬러풀한 곳에는 RouteBadge(진한 단색)을 쓴다.

const TONE_BY_ROUTE = {
  // 초록 (시흥 시내)
  '시흥33': 'green', '33': 'green', '11-A': 'green', '시흥1': 'green',
  // 파랑 (시흥/광역 파란 계열)
  '20-1': 'blue', '5602': 'blue',
  // 빨강 (광역 직행)
  '5200': 'red', '3400': 'red', '3401': 'red', '6502': 'red',
  // 보라 (강남 방향)
  '99-2': 'purple',
  // 노랑 (지하철 수인분당 / 셔틀)
  '수인분당': 'yellow', '상행': 'yellow', '하행': 'yellow',
}

const TONE_CLASS = {
  green:  'bg-chip-green-bg text-chip-green-fg dark:bg-chip-green-bg dark:text-chip-green-fg',
  blue:   'bg-chip-blue-bg text-chip-blue-fg dark:bg-chip-blue-bg dark:text-chip-blue-fg',
  red:    'bg-chip-red-bg text-chip-red-fg dark:bg-chip-red-bg dark:text-chip-red-fg',
  purple: 'bg-chip-purple-bg text-chip-purple-fg dark:bg-chip-purple-bg dark:text-chip-purple-fg',
  yellow: 'bg-chip-yellow-bg text-chip-yellow-fg dark:bg-chip-yellow-bg dark:text-chip-yellow-fg',
  gray:   'bg-surface-2 text-ink-2 dark:bg-bg dark:text-ink-2',
}

function getTone(route) {
  if (!route) return 'gray'
  if (TONE_BY_ROUTE[route]) return TONE_BY_ROUTE[route]
  for (const key of Object.keys(TONE_BY_ROUTE)) {
    if (route.includes(key)) return TONE_BY_ROUTE[key]
  }
  return 'gray'
}

export default function RouteChip({ route, label, size = 'mob', className = '' }) {
  const display = label ?? route ?? ''
  const tone = getTone(route)
  const sizeClass = size === 'pc' ? 'text-chip-pc min-w-[32px] px-1.5 py-[1px]' : 'text-chip min-w-[36px] px-2 py-[3px]'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-chip tabular-nums whitespace-nowrap shrink-0 ${sizeClass} ${TONE_CLASS[tone]} ${className}`}
    >
      {display}
    </span>
  )
}
