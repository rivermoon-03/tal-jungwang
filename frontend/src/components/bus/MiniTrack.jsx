// 미니 트랙 — 출발·경유·종점 도트+라인 + 라벨 시각화
// props: origin, waypoints (string[]), terminus, category, muted

const COLOR_BY_CATEGORY = {
  express: {
    dot:   'bg-line-express',
    halo:  'shadow-[0_0_0_3px_var(--tw-shadow-color)] shadow-route-halo-express dark:shadow-route-halo-express-dark',
    label: 'text-line-express',
  },
  trunk: {
    dot:   'bg-line-201',
    halo:  'shadow-[0_0_0_3px_var(--tw-shadow-color)] shadow-route-halo-trunk dark:shadow-route-halo-trunk-dark',
    label: 'text-line-201',
  },
  local: {
    dot:   'bg-line-33',
    halo:  'shadow-[0_0_0_3px_var(--tw-shadow-color)] shadow-route-halo-local dark:shadow-route-halo-local-dark',
    label: 'text-line-33',
  },
}

export default function MiniTrack({
  origin,
  waypoints = [],
  terminus,
  category = 'local',
  muted = false,
}) {
  const cat = COLOR_BY_CATEGORY[category] ?? COLOR_BY_CATEGORY.local

  // Track grid — start dot + alternating segment/dot + end dot
  const trackTemplate = (() => {
    const n = waypoints.length
    if (n === 0) return '12px 1fr 8px'
    if (n === 1) return '12px 1fr 8px 1fr 8px'
    return '12px 1fr 8px 1fr 8px 1fr 8px'
  })()

  // Label grid
  const labelTemplate = (() => {
    const n = waypoints.length
    if (n === 0) return 'auto 1fr auto'
    if (n === 1) return '1fr 1fr 1fr'
    return '1fr 1fr 1fr 1fr'
  })()

  const dotMute = 'bg-mute-2 dark:bg-mute-2-dark'
  const dotInk  = 'bg-ink dark:bg-ink-dark'
  const segMute = 'bg-mute-2 dark:bg-mute-2-dark'
  const segInk  = 'bg-ink dark:bg-ink-dark'

  const startDotCls = muted
    ? `w-[11px] h-[11px] rounded-full justify-self-center ${dotMute}`
    : `w-[11px] h-[11px] rounded-full justify-self-center ${cat.dot} ${cat.halo}`

  const inlineDot = (key) => (
    <span
      key={key}
      data-track-pt="mid"
      className={`w-[7px] h-[7px] rounded-full justify-self-center ${muted ? dotMute : dotInk}`}
    />
  )

  const inlineSeg = (key) => (
    <span key={key} className={`h-[2px] rounded-[1px] ${muted ? segMute : segInk}`} />
  )

  // Build track children: start → seg → [mid → seg]* → end
  const trackChildren = []
  trackChildren.push(
    <span key="s" data-track-pt="start" className={startDotCls} />
  )
  trackChildren.push(inlineSeg('s0'))
  waypoints.forEach((_, i) => {
    trackChildren.push(inlineDot(`v${i}`))
    trackChildren.push(inlineSeg(`s${i + 1}`))
  })
  trackChildren.push(
    <span
      key="e"
      data-track-pt="end"
      className={`w-[7px] h-[7px] rounded-full justify-self-center ${muted ? dotMute : dotInk}`}
    />
  )

  const startLabelCls = muted
    ? 'text-left truncate text-[12px] font-extrabold tracking-[-.01em] text-mute-2 dark:text-mute-2-dark'
    : `text-left truncate text-[12px] font-extrabold tracking-[-.01em] ${cat.label}`

  const midLabelCls = muted
    ? 'text-center truncate text-[11px] font-bold tracking-[-.005em] text-mute-2 dark:text-mute-2-dark'
    : 'text-center truncate text-[11px] font-bold tracking-[-.005em] text-ink dark:text-ink-dark'

  const endLabelCls = muted
    ? 'text-right truncate text-[11px] font-bold tracking-[-.005em] text-mute-2 dark:text-mute-2-dark'
    : 'text-right truncate text-[11px] font-bold tracking-[-.005em] text-ink dark:text-ink-dark'

  return (
    <div className="mt-[9px] pr-1">
      {/* Track row: dots + segments */}
      <div className="grid items-center h-4" style={{ gridTemplateColumns: trackTemplate }}>
        {trackChildren}
      </div>

      {/* Label row */}
      <div className="grid mt-[5px] gap-0" style={{ gridTemplateColumns: labelTemplate }}>
        <span data-track-label="start" className={startLabelCls}>{origin}</span>
        {waypoints.length === 0 ? <span /> : null}
        {waypoints.map((w, i) => (
          <span key={i} data-track-label="mid" className={midLabelCls}>{w}</span>
        ))}
        <span data-track-label="end" className={endLabelCls}>{terminus}</span>
      </div>
    </div>
  )
}
