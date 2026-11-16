import { lineBadgeColors } from './lineColors'

/** 노선 뱃지. 색이 밝은 노선(수인분당, 서해선)은 진한 글자를 쓴다. */
export default function LineBadge({ route, size = 'md', className = '' }) {
  const { bg, fg } = lineBadgeColors(route)
  const sz = size === 'sm' ? 'text-f12 px-1.5 py-0.5 rounded-[5px]' : 'text-f14 px-2 py-1 rounded-md'
  return (
    <span
      className={`inline-block flex-none whitespace-nowrap text-center font-extrabold leading-none ${sz} ${className}`}
      style={{ background: bg, color: fg }}
    >
      {route}
    </span>
  )
}
