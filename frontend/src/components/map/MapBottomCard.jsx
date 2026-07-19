/**
 * MapBottomCard — PC 지도 하단에 얹는 플로팅 도착 카드.
 *
 * 순수 프레젠테이셔널 컴포넌트. 데이터 패칭/스토어 접근 없음, props로만 동작한다.
 * 부모(PCMapDashboard 등)가 절대 위치 배치를 담당한다.
 *
 * 참고: pc-mockup.html의 .map-bottom / .bottom-card / .route-row 마크업을
 * 프로젝트 Tailwind + var(--tj-*) 토큰으로 옮긴 것.
 */

const STATUS_TONE_CLASS = {
  ease: 'bg-ease/15 text-ease',
  imminent: 'bg-imminent-bg text-imminent',
  delayed: 'bg-delayed-bg text-delayed',
}

const MINI_TONE_CLASS = {
  ease: 'text-ease',
  imminent: 'text-imminent',
  delayed: 'text-delayed',
}

export default function MapBottomCard({
  stationName,
  live = false,
  statusLabel,
  statusTone = 'ease',
  primary = {},
  routes = [],
  onSelectRoute,
  className = '',
  showGrip = true,
}) {
  const { routeName, direction, etaText, nextText, lastText } = primary
  const statusClass = STATUS_TONE_CLASS[statusTone] ?? STATUS_TONE_CLASS.ease

  return (
    <div
      className={`rounded-sheet border border-line bg-surface px-4 pb-[14px] pt-3 shadow-sh-pop ${className}`}
    >
      {showGrip && (
        <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-[38px] rounded-pill bg-line-strong" />
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-extrabold text-ink">{stationName}</h3>
        <div className="flex flex-none items-center gap-[6px]">
          {live && (
            <span className="inline-flex items-center gap-[6px] rounded-pill bg-accent px-[10px] py-[3px] text-[11px] font-bold text-white">
              <span aria-hidden="true" className="h-[6px] w-[6px] rounded-pill bg-white animate-dot-blink" />
              실시간
            </span>
          )}
          {statusLabel && (
            <span className={`rounded-pill px-[11px] py-[4px] text-[12px] font-bold ${statusClass}`}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {(routeName || direction) && (
        <p className="text-[12.5px] font-semibold text-ink-2">
          {routeName}
          {routeName && direction ? ' · ' : ''}
          {direction}
        </p>
      )}

      {etaText && (
        <p className="tabular-nums text-[30px] font-extrabold tracking-[-0.03em] text-ink">
          {etaText}
        </p>
      )}

      {(nextText || lastText) && (
        <p className="text-[12px] text-mute">
          {[nextText, lastText].filter(Boolean).join(' · ')}
        </p>
      )}

      {routes.length > 0 && (
        <div className="scrollbar-hide mt-3 flex gap-[10px] overflow-x-auto pb-[2px]">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute?.(route.id)}
              className="pressable flex-none w-[150px] rounded-card border border-line bg-surface-2 px-3 py-[11px] text-left"
            >
              <span className="mb-[7px] flex items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{ background: route.color }}
                  className="grid h-5 w-[26px] flex-none place-items-center rounded-badge text-[11px] font-extrabold text-white"
                >
                  {route.badge}
                </span>
                <span className="truncate text-[12.5px] font-bold text-ink">{route.name}</span>
              </span>
              <span
                className={`block tabular-nums text-[18px] font-extrabold tracking-[-0.02em] ${
                  MINI_TONE_CLASS[route.tone] ?? 'text-ink'
                }`}
              >
                {route.etaText}
              </span>
              {route.sub && <span className="block text-[11px] text-mute">{route.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
