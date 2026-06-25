// 미니 트랙 — 출발·경유·종점 도트+라인 + 라벨 시각화 (시안 1: 경로 트랙 강화)
// props: origin, waypoints (string[]), terminus, category, muted

const COLOR_BY_CATEGORY = {
  express: {
    dot:   'bg-line-express',
    halo:  'shadow-[0_0_0_4px_var(--tw-shadow-color)] shadow-route-halo-express dark:shadow-route-halo-express-dark',
    label: 'text-line-express',
    // 그라디언트 start color for track line
    gradFrom: 'var(--tj-line-express, #dc2626)',
  },
  trunk: {
    dot:   'bg-line-201',
    halo:  'shadow-[0_0_0_4px_var(--tw-shadow-color)] shadow-route-halo-trunk dark:shadow-route-halo-trunk-dark',
    label: 'text-line-201',
    gradFrom: 'var(--tj-line-201, #2563eb)',
  },
  local: {
    dot:   'bg-line-33',
    halo:  'shadow-[0_0_0_4px_var(--tw-shadow-color)] shadow-route-halo-local dark:shadow-route-halo-local-dark',
    label: 'text-line-33',
    gradFrom: 'var(--tj-line-33, #0891b2)',
  },
}

// Tailwind 색상 토큰 → CSS 변수 매핑 (그라디언트용)
const CAT_GRAD_START = {
  express: '#dc2626',
  trunk:   '#2563eb',
  local:   '#0891b2',
}

export default function MiniTrack({
  origin,
  waypoints = [],
  terminus,
  category = 'local',
  muted = false,
}) {
  const cat = COLOR_BY_CATEGORY[category] ?? COLOR_BY_CATEGORY.local
  const gradStart = CAT_GRAD_START[category] ?? CAT_GRAD_START.local

  // Track grid — start dot + alternating segment/dot + end dot
  // 시안 1: 시작(14px) · 경유(11px) · 종점(14px), 세그먼트는 auto
  const n = waypoints.length
  const trackTemplate = (() => {
    if (n === 0) return '14px 1fr 14px'
    if (n === 1) return '14px 1fr 11px 1fr 14px'
    return '14px 1fr 11px 1fr 11px 1fr 14px'
  })()

  // Label grid (스테이션 이름 + 역할 행 — 동일 template)
  const labelTemplate = (() => {
    if (n === 0) return 'auto 1fr auto'
    if (n === 1) return '1fr 1fr 1fr'
    return '1fr 1fr 1fr 1fr'
  })()

  const dotMute  = 'bg-mute-2 dark:bg-mute-2-dark'
  const dotInk   = 'bg-ink dark:bg-ink-dark'

  // 시작 노드: 14px · 채움 · halo
  const startDotCls = muted
    ? `w-[14px] h-[14px] rounded-full justify-self-start ${dotMute}`
    : `w-[14px] h-[14px] rounded-full justify-self-start ${cat.dot} ${cat.halo}`

  // 경유 노드: 11px · hollow (surface 배경 + border)
  const midDotCls = muted
    ? `w-[11px] h-[11px] rounded-full justify-self-center border-[2px] border-mute-2 dark:border-mute-2-dark bg-surface dark:bg-surface-dark`
    : `w-[11px] h-[11px] rounded-full justify-self-center border-[2.5px] border-ink-2 dark:border-ink-dark bg-surface dark:bg-surface-dark`

  // 종점 노드: 14px · 채움 · halo
  const endDotCls = muted
    ? `w-[14px] h-[14px] rounded-full justify-self-end ${dotMute}`
    : `w-[14px] h-[14px] rounded-full justify-self-end ${dotInk} shadow-[0_0_0_4px_rgba(27,42,74,0.12)] dark:shadow-[0_0_0_4px_rgba(255,255,255,0.10)]`

  const inlineMidDot = (key) => (
    <span
      key={key}
      data-track-pt="mid"
      className={midDotCls}
    />
  )

  const inlineSeg = (key) => (
    <span
      key={key}
      data-track-seg
      className={
        muted
          ? 'h-[3px] rounded-[2px] bg-mute-2 dark:bg-mute-2-dark'
          : 'h-[3px] rounded-[2px] bg-ink dark:bg-ink-dark opacity-[.6]'
      }
    />
  )

  // Build track children: start → seg → [mid → seg]* → end
  const trackChildren = []
  trackChildren.push(
    <span key="s" data-track-pt="start" className={startDotCls} />
  )
  trackChildren.push(inlineSeg('s0'))
  waypoints.forEach((_, i) => {
    trackChildren.push(inlineMidDot(`v${i}`))
    trackChildren.push(inlineSeg(`s${i + 1}`))
  })
  trackChildren.push(
    <span key="e" data-track-pt="end" className={endDotCls} />
  )

  // 라벨 스타일 — 시안 1: 13px
  const startLabelCls = muted
    ? 'text-left truncate text-[13px] font-extrabold tracking-[-.01em] text-mute-2 dark:text-mute-2-dark'
    : `text-left truncate text-[13px] font-extrabold tracking-[-.01em] ${cat.label}`

  const midLabelCls = muted
    ? 'text-center truncate text-[13px] font-bold tracking-[-.005em] text-mute-2 dark:text-mute-2-dark'
    : 'text-center truncate text-[13px] font-bold tracking-[-.005em] text-ink-2 dark:text-ink-dark'

  const endLabelCls = muted
    ? 'text-right truncate text-[13px] font-bold tracking-[-.005em] text-mute-2 dark:text-mute-2-dark'
    : 'text-right truncate text-[13px] font-extrabold tracking-[-.005em] text-ink dark:text-ink-dark'

  // 역할 라벨 스타일 — 12px, mute
  const roleLabelCls = 'text-[12px] font-semibold text-mute dark:text-mute-dark leading-none'

  return (
    <div className="mt-[9px] pr-1">
      {/* Track row: 절대 위치 그라디언트 라인 + 노드 그리드 */}
      <div className="relative" style={{ paddingLeft: '1px', paddingRight: '1px' }}>
        {/* 그라디언트 라인 (absolute, 노드 중앙 높이) */}
        {!muted && (
          <div
            aria-hidden
            className="absolute rounded-[2px] opacity-80"
            style={{
              top: '50%',
              left: '7px',
              right: '7px',
              height: '3px',
              transform: 'translateY(-50%)',
              background: `linear-gradient(90deg, ${gradStart} 0%, var(--tj-ink, #1B2A4A) 65%, var(--tj-ink, #1B2A4A) 100%)`,
            }}
          />
        )}
        {muted && (
          <div
            aria-hidden
            className="absolute rounded-[2px]"
            style={{
              top: '50%',
              left: '7px',
              right: '7px',
              height: '3px',
              transform: 'translateY(-50%)',
              background: 'var(--tw-bg-opacity, rgba(203,210,219,1))',
              opacity: 0.5,
            }}
          />
        )}
        {/* 노드 그리드 (라인 위에 올라감) */}
        <div
          className="relative grid items-center"
          style={{ gridTemplateColumns: trackTemplate, height: '18px' }}
        >
          {trackChildren}
        </div>
      </div>

      {/* 역 이름 라벨 행 */}
      <div className="grid mt-[6px] gap-0" style={{ gridTemplateColumns: labelTemplate }}>
        <span data-track-label="start" className={startLabelCls}>{origin}</span>
        {n === 0 ? <span /> : null}
        {waypoints.map((w, i) => (
          <span key={i} data-track-label="mid" className={midLabelCls}>{w}</span>
        ))}
        <span data-track-label="end" className={endLabelCls}>{terminus}</span>
      </div>

      {/* 역할 라벨 행 (출발/경유/종점) */}
      <div className="grid mt-[2px] gap-0" style={{ gridTemplateColumns: labelTemplate }}>
        <span data-track-role="origin" className={`text-left ${roleLabelCls}`}>출발</span>
        {n === 0 ? <span /> : null}
        {waypoints.map((_, i) => (
          <span key={i} data-track-role="waypoint" className={`text-center ${roleLabelCls}`}>경유</span>
        ))}
        <span data-track-role="terminus" className={`text-right ${roleLabelCls}`}>종점</span>
      </div>
    </div>
  )
}
