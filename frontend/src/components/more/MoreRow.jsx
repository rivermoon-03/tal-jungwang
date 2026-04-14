/**
 * MoreRow — single list row for the more page.
 * Props:
 *   icon       ReactNode
 *   label      string
 *   value      string | ReactNode  (trailing value, optional)
 *   chevron    boolean  (show ›, default false)
 *   badge      number | null  (unread badge, optional)
 *   onClick    () => void
 *   href       string  (external link, optional)
 *   first      boolean  (rounded top corners)
 *   last       boolean  (rounded bottom corners)
 */
import { ChevronRight } from 'lucide-react'

export default function MoreRow({
  icon,
  label,
  value,
  chevron = false,
  badge,
  onClick,
  href,
  first = false,
  last = false,
}) {
  const radiusClass = `${first ? 'rounded-t-[18px]' : ''} ${last ? 'rounded-b-[18px]' : ''}`
  const borderClass = !last ? 'border-b border-slate-100 dark:border-slate-700' : ''

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {icon && (
        <span className="w-7 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400">
          {icon}
        </span>
      )}
      <p className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-coral text-white text-[10px] font-bold">
          {badge}
        </span>
      )}
      {value != null && (
        <span className="text-sm text-slate-400 dark:text-slate-500">{value}</span>
      )}
      {chevron && (
        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
      )}
    </div>
  )

  const cls = `block w-full text-left bg-white dark:bg-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 ${borderClass} ${radiusClass} overflow-hidden`

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    )
  }
  if (onClick) {
    return (
      <button onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}
