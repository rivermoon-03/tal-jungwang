import { tjLineColor } from '../common/lineColor'

/**
 * RouteBadge
 * variant="solid" (기본): 배경 = tjLineColor(route), 흰 텍스트
 * variant="soft": 옅은 배경 + 노선색 텍스트 (보조용)
 */
export default function RouteBadge({ route, variant = 'solid', className = '' }) {
  const color = tjLineColor(route)

  const base =
    'inline-flex items-center justify-center rounded-badge px-2 py-[3px] text-[15px] font-semibold tabular-nums leading-none select-none'

  const inlineStyle =
    variant === 'solid'
      ? { background: color, color: '#ffffff' }
      : { background: `color-mix(in srgb, ${color} 15%, transparent)`, color }

  return (
    <span className={[base, className].filter(Boolean).join(' ')} style={inlineStyle}>
      {route}
    </span>
  )
}
