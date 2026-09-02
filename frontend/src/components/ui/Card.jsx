import { ChevronRight } from 'lucide-react'

// 기본(default) 상태만 표면을 "띄운다" — 라이트는 shadow-sh-card, 다크는
// shadow-sh-card가 :root에서만 유효해 보이지 않으므로 --line 보더로 대체한다
// (DESIGN.md §4: 보더+그림자 동시 사용 금지). 나머지 상태(imminent/selected/muted)는
// 이미 보더로 강조 중이라 그림자를 얹지 않는다 — 얹으면 금지 규칙을 어긴다.
const stateClasses = {
  default: 'bg-surface shadow-sh-card dark:bg-surface dark:border dark:border-line dark:shadow-none',
  imminent: 'bg-imminent/[0.06] border border-imminent',
  selected: 'bg-accent-bg border-[1.5px] border-accent',
  muted: 'bg-surface border border-line/50 text-mute',
}

const interactiveClasses =
  'cursor-pointer transition-transform duration-100 active:scale-[0.98] select-none'

// 패딩 프리셋 — 기본 18px(시안2 규격), compact는 16px(레거시 p-4와 동일해
// 촘촘한 리스트형 카드에 쓴다). "none"은 색상 헤더가 카드 모서리까지 꽉 차야
// 하는 다분할 카드(SubwayLineCard 등)를 위한 탈출구다 — 그 경우 각 섹션이
// 자체 패딩을 책임진다.
const PADDING_CLASS = {
  default: 'p-[18px]',
  compact: 'p-4',
  none: '',
}

export default function Card({
  state = 'default',
  interactive = false,
  compact = false,
  padding,
  as: Tag = 'div',
  onClick,
  className = '',
  children,
}) {
  const paddingKey = padding ?? (compact ? 'compact' : 'default')
  const base = `rounded-card ${PADDING_CLASS[paddingKey] ?? PADDING_CLASS.default}`.trim()
  const stateStyle = stateClasses[state] ?? stateClasses.default
  const interactiveStyle = interactive ? interactiveClasses : ''

  const combined = [base, stateStyle, interactiveStyle, className]
    .filter(Boolean)
    .join(' ')

  return (
    // onClick은 interactive 여부와 무관하게 항상 넘긴다 — chevron(화살표 어포던스)만
    // interactive에 종속된다. 클릭은 되지만 chevron 화살표는 어울리지 않는 다분할
    // 카드(SubwayLineCard 등)가 있어서 둘을 분리했다.
    <Tag className={combined} onClick={onClick}>
      <span className="flex items-center gap-2">
        <span className="flex-1">{children}</span>
        {interactive && (
          <ChevronRight
            className="shrink-0 text-ink-2"
            size={18}
            aria-hidden="true"
          />
        )}
      </span>
    </Tag>
  )
}
