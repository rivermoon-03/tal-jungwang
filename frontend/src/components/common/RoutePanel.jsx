// PC 좌측 패널의 표준 컨테이너.
// pnl-head (subtitle + title + meta) + pnl-tabs (optional) + pnl-body.
//
// 다크 모드: 1px 헤어라인 + #0a0a0a surface. shadow-sh-*는 :root에서만 유효해
// 예전 shadow-card-md는 다크에서 아무 경계도 안 보였다 — dark:border로 대체한다.
// rounded-card-pc(14px)는 카드(20px)보다 한 단계 작은 PC 전용 반경이라
// ui/Card(rounded-card 고정)를 그대로 쓰지 않고 이 컴포넌트를 유지한다.

export default function RoutePanel({
  subtitle,
  title,
  meta,
  tabs,        // [{ id, label }]
  activeTab,
  onTabChange,
  children,
  className = '',
}) {
  return (
    <section
      className={`flex flex-col rounded-card-pc bg-surface shadow-sh-lift dark:bg-surface dark:border dark:border-line dark:shadow-none overflow-hidden ${className}`}
    >
      <header className="flex items-start justify-between px-[14px] pt-3 pb-2">
        <div>
          {subtitle && (
            <div className="text-dest uppercase font-bold text-mute dark:text-mute">
              {subtitle}
            </div>
          )}
          {title && (
            <h2 className="mt-[2px] text-panel-ttl text-ink dark:text-white">{title}</h2>
          )}
        </div>
        {meta && (
          <div className="text-meta font-bold text-mute dark:text-mute">{meta}</div>
        )}
      </header>

      {tabs && tabs.length > 0 && (
        <nav className="flex gap-1 px-[14px] pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange?.(t.id)}
              className={`text-label font-bold px-[10px] py-[4px] rounded-pill pressable ${
                activeTab === t.id
                  ? 'bg-ink text-surface dark:bg-accent dark:text-black'
                  : 'bg-surface-2 text-ink-2 dark:bg-bg dark:text-mute'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex-1 overflow-y-auto px-[10px] pb-[10px] min-h-0">
        {children}
      </div>
    </section>
  )
}
