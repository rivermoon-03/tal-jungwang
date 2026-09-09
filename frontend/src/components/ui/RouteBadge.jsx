import { Bus, TrainFront, Route as RouteGlyph } from 'lucide-react'
import { tjLineColor } from '../common/lineColor'

// 노선 배지의 정본이다. 색은 항상 common/lineColor.js(tjLineColor)에서만
// 읽는다 — 화면마다 색을 따로 계산하지 않는다. common/RouteChip.jsx는 유일한
// 사용처(common/RouteRow.jsx)가 이 컴포넌트로 옮겨져 삭제됐다(2026-09).
// common/RouteBadge.jsx는 favorites/FavoritesTimeline.jsx(다른 담당자 영역)가
// 아직 참조 중이라 여기서 통합하지 않는다.
const MODE_GLYPH = { bus: Bus, subway: TrainFront, shuttle: RouteGlyph }

/**
 * RouteBadge
 * variant="solid" (기본): 배경 = tjLineColor(route), 흰 텍스트. 인라인 필.
 * variant="soft": 옅은 배경 + 노선색 텍스트 (보조용). 인라인 필.
 * variant="tile": 정사각 타일(도착 카드 첫 자리). size='md'는 56px, 'lg'는 64px.
 *   mode('bus'|'subway'|'shuttle')를 넘기면 번호 위에 노선 종류 글리프를 얹는다
 *   (색만으로 노선 종류를 구분하지 않는다).
 *
 * color: 노선색을 DB(ui_meta)에서 받아 오는 호출부를 위한 덮어쓰기. 넘기지
 *   않으면 route 로 tjLineColor 가 정한다 — 색을 화면마다 따로 계산하지 않는다.
 */
const TILE_SIZE = {
  md: { box: 'w-14 h-14 text-mini-ttl', glyph: 14 },
  lg: { box: 'w-16 h-16 text-label',    glyph: 16 },
}

export default function RouteBadge({ route, variant = 'solid', mode, size = 'md', color: colorOverride, className = '' }) {
  const color = colorOverride ?? tjLineColor(route)

  if (variant === 'tile') {
    const Glyph = MODE_GLYPH[mode] ?? null
    const tile = TILE_SIZE[size] ?? TILE_SIZE.md
    return (
      <span
        className={[
          'inline-flex flex-none flex-col items-center justify-center gap-0.5',
          'rounded-tile font-bold tabular-nums leading-none',
          tile.box,
          'whitespace-nowrap select-none',
          className,
        ].filter(Boolean).join(' ')}
        style={{ background: color, color: '#ffffff' }}
      >
        {Glyph && <Glyph size={tile.glyph} strokeWidth={2.4} aria-hidden="true" className="opacity-90" />}
        {route}
      </span>
    )
  }

  const base =
    'inline-flex items-center justify-center rounded-badge px-2 py-[3px] text-label font-semibold tabular-nums leading-none select-none'

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
