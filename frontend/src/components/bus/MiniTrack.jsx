// 미니 트랙 — 출발·경유·종점 칩 라인 (시안 3: 칩 라인형)
// props: origin, waypoints (string[]), terminus, category, muted
//
// 이전(시안1)은 정류장 라벨을 고정 컬럼 그리드에 넣어서, 역명이 길거나(시흥시청 등)
// 경유지가 많으면 좁은 폰 폭(360~390px)에서 라벨이 겹치거나 줄바꿈이 났다. 칩을
// flex-wrap으로 배치하면 폭이 좁을 때 칩이 자연스레 다음 줄로 넘어갈 뿐 절대
// 겹치거나 잘리지 않는다.

const COLOR_BY_CATEGORY = {
  express: { chipBg: 'bg-line-express' },
  trunk:   { chipBg: 'bg-line-201' },
  local:   { chipBg: 'bg-line-33' },
}

export default function MiniTrack({
  origin,
  waypoints = [],
  terminus,
  category = 'local',
  muted = false,
}) {
  const cat = COLOR_BY_CATEGORY[category] ?? COLOR_BY_CATEGORY.local

  const originChipCls = muted
    ? 'bg-line-strong dark:bg-line-strong text-white dark:text-ink'
    : `${cat.chipBg} text-white`
  const waypointChipCls = muted
    ? 'bg-surface-2 dark:bg-surface-2 text-line-strong dark:text-line-strong'
    : 'bg-surface-2 dark:bg-surface-2 text-ink-2 dark:text-ink'
  const terminusChipCls = muted
    ? 'bg-line-strong dark:bg-line-strong text-white dark:text-ink'
    : 'bg-ink dark:bg-ink text-bg dark:text-bg'

  const chipBase = 'inline-flex items-center rounded-chip px-2 py-[3px] text-chip truncate max-w-[120px]'
  const arrow = <span className="text-mute dark:text-mute text-meta shrink-0" aria-hidden="true">→</span>

  const items = [
    { key: 'start', role: '출발', name: origin, cls: originChipCls, dataPt: 'start' },
    ...waypoints.map((w, i) => ({ key: `mid${i}`, role: '경유', name: w, cls: waypointChipCls, dataPt: 'mid' })),
    { key: 'end', role: '종점', name: terminus, cls: terminusChipCls, dataPt: 'end' },
  ]

  return (
    <div className="mt-[9px] flex flex-wrap items-center gap-x-1 gap-y-1.5 pr-1">
      {items.map((it, i) => (
        <span key={it.key} className="inline-flex items-center gap-1">
          {i > 0 && arrow}
          <span className="inline-flex flex-col items-center gap-0.5">
            <span
              data-track-pt={it.dataPt}
              data-track-label={it.dataPt}
              className={`${chipBase} ${it.cls}`}
            >
              {it.name}
            </span>
            <span data-track-role={it.dataPt === 'start' ? 'origin' : it.dataPt === 'end' ? 'terminus' : 'waypoint'} className="text-meta text-mute dark:text-mute leading-none">
              {it.role}
            </span>
          </span>
        </span>
      ))}
    </div>
  )
}
