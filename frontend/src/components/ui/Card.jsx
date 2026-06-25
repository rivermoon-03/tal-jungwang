import { ChevronRight } from 'lucide-react'

const stateClasses = {
  default: 'bg-surface border border-line',
  imminent: 'bg-imminent/[0.06] border border-imminent',
  selected: 'bg-accent-bg border-[1.5px] border-accent',
  muted: 'bg-surface border border-line/50 text-mute',
}

const interactiveClasses =
  'cursor-pointer transition-transform duration-100 active:scale-[0.98] select-none'

export default function Card({
  state = 'default',
  interactive = false,
  as: Tag = 'div',
  onClick,
  className = '',
  children,
}) {
  const base = 'rounded-[16px] p-4'
  const stateStyle = stateClasses[state] ?? stateClasses.default
  const interactiveStyle = interactive ? interactiveClasses : ''

  const combined = [base, stateStyle, interactiveStyle, className]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag className={combined} onClick={interactive ? onClick : undefined}>
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
