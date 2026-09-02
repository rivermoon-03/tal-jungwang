/**
 * MapBottomCard — PC 지도 하단에 얹는 플로팅 도착 카드.
 *
 * 순수 프레젠테이셔널 컴포넌트. 데이터 패칭/스토어 접근 없음, props로만 동작한다.
 * 부모(PCMapDashboard 등)가 절대 위치 배치를 담당한다.
 *
 * 참고: pc-mockup.html의 .map-bottom / .bottom-card / .route-row 마크업을
 * 프로젝트 Tailwind + var(--tj-*) 토큰으로 옮긴 것.
 */
import EmptyState from '../ui/EmptyState'
import DataBadge from '../ui/DataBadge'

const STATUS_TONE_CLASS = {
  ease: 'bg-ease/15 text-ease',
  imminent: 'bg-imminent-bg text-imminent',
  delayed: 'bg-delayed-bg text-delayed',
}

const MINI_TONE_CLASS = {
  ease: 'text-ease',
  imminent: 'text-imminent',
  delayed: 'text-delayed',
  muted: 'text-mute',
}

export default function MapBottomCard({
  stationName,
  live = false,
  statusLabel,
  statusTone = 'ease',
  primary = {},
  routes = [],
  onSelectRoute,
  emptyState = null,
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

      {/* "실시간" 배지는 정류장 이름 옆(헤더)에 걸지 않는다. 거기 걸면 아래
          노선 미니카드 전체가 실시간인 것처럼 읽힌다 — live는 대표(primary)
          노선 하나의 실시간 여부라 그 줄에만 붙인다. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-body-sm font-extrabold text-ink">{stationName}</h3>
        {statusLabel && (
          <span className={`flex-none rounded-pill px-[11px] py-[4px] text-chip font-bold ${statusClass}`}>
            {statusLabel}
          </span>
        )}
      </div>

      {(routeName || direction) && (
        <p className="flex items-center gap-[6px] text-caption font-semibold text-ink-2">
          <span>
            {routeName}
            {routeName && direction ? ' · ' : ''}
            {direction}
          </span>
          <DataBadge state={live ? 'live' : 'timetable'} />
        </p>
      )}

      {etaText && (
        <p className="tabular-nums text-bigMin font-extrabold tracking-[-0.03em] text-ink">
          {etaText}
        </p>
      )}

      {(nextText || lastText) && (
        <p className="text-meta font-normal text-mute">
          {[nextText, lastText].filter(Boolean).join(' · ')}
        </p>
      )}

      {routes.length === 0 && emptyState && (
        <EmptyState
          size="sm"
          title={emptyState.title}
          desc={emptyState.description}
          className="pt-1"
        />
      )}

      {routes.length > 0 && (
        // PC는 가로 캐러셀 대신 2열 그리드로 쌓는다. 마우스로 가로 스크롤을 하기
        // 어렵고, 패널 폭이 고정이라 두 번째 카드가 잘려 보였다.
        <div className="scrollbar-hide mt-3 flex gap-[10px] overflow-x-auto pb-[2px] md:grid md:grid-cols-2 md:overflow-visible">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute?.(route.id)}
              className="pressable hoverable flex-none w-[150px] rounded-card border border-line bg-surface-2 px-3 py-[11px] text-left md:w-auto"
            >
              <span className="mb-[7px] flex items-center gap-2">
                {/* min-w-[26px] + whitespace-nowrap — 고정 w-[26px]에 "시흥33"·
                    "20-1" 같은 노선번호가 안 들어가 두 줄로 꺾이면서 옆 노선명
                    텍스트 위로 삐져나와 겹쳐 보였다. 폭을 내용에 맞춰 늘어나게
                    하고 한 줄로 강제한다(TransitCard 타일의 whitespace-nowrap과 동일 이유). */}
                <span
                  aria-hidden="true"
                  style={{ background: route.color }}
                  className="grid h-5 min-w-[26px] flex-none place-items-center whitespace-nowrap rounded-badge px-1 text-chip font-extrabold text-white"
                >
                  {route.badge}
                </span>
                <span className="truncate text-caption font-bold text-ink">{route.name}</span>
              </span>
              <span className="flex items-center gap-[6px]">
                <span
                  className={`tabular-nums text-display font-extrabold tracking-[-0.02em] ${
                    MINI_TONE_CLASS[route.tone] ?? 'text-ink'
                  }`}
                >
                  {route.etaText}
                </span>
                {/* 노선별 실시간/시간표 출처. source가 null이면(운행 정보 없음)
                    배지를 그리지 않는다 — "시간표"를 달면 마치 다음 출발
                    시각이 있는 것처럼 보여 오히려 오해를 만든다. */}
                {route.source && <DataBadge state={route.source} compact />}
              </span>
              {route.sub && <span className="block text-meta font-normal text-mute">{route.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
