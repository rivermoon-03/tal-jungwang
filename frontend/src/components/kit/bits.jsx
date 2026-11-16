// 작은 표시 부품 모음. 화면 어디서나 같은 모양을 쓴다.

const CHIP = {
  open: 'bg-accent-bg text-accent-ink',
  soon: 'bg-imminent-bg text-amber-800 dark:text-amber-300',
  closed: 'bg-surface-3 text-ink-2',
  error: 'bg-delayed-bg text-red-700 dark:text-red-300',
}

export function Pill({ kind = 'open', children }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-f13 font-extrabold ${CHIP[kind]}`}>
      {children}
    </span>
  )
}

const BANNER = {
  info: 'bg-surface-2 border border-line text-ink',
  warn: 'bg-imminent-bg text-amber-900 dark:text-amber-200',
  error: 'bg-delayed-bg text-red-800 dark:text-red-200',
}

export function Banner({ kind = 'info', Icon, title, children }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 ${BANNER[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      {Icon && <Icon size={18} className="mt-0.5 flex-none" aria-hidden="true" />}
      <div className="min-w-0">
        {title && <p className="text-f15 font-extrabold">{title}</p>}
        {children && <div className="text-f14">{children}</div>}
      </div>
    </div>
  )
}

export function SectionLabel({ Icon, children, trailing }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-5">
      <span className="flex items-center gap-1.5 text-f14 font-extrabold text-mute">
        {Icon && <Icon size={15} aria-hidden="true" />}
        {children}
      </span>
      {trailing}
    </div>
  )
}

export function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`block rounded-[20px] border border-line bg-surface ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** 데이터가 오기 전 자리 */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-surface-3 ${className}`} aria-hidden="true" />
}
