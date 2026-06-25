// PC 좌측 패널의 표준 컨테이너.
// pnl-head (subtitle + title + meta) + pnl-tabs (optional) + pnl-body.
//
// 다크 모드: 1px 헤어라인 + #0a0a0a surface.

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
      className={`flex flex-col rounded-card-pc bg-surface shadow-card-md dark:bg-surface-dark dark:border dark:border-line-dark dark:shadow-none overflow-hidden ${className}`}
    >
      <header className="flex items-start justify-between px-[14px] pt-3 pb-2">
        <div>
          {subtitle && (
            <div className="text-ghdr uppercase font-bold text-mute dark:text-mute-dark">
              {subtitle}
            </div>
          )}
          {title && (
            <h2 className="mt-[2px] text-panel-ttl text-ink dark:text-white">{title}</h2>
          )}
        </div>
        {meta && (
          <div className="text-meta font-bold text-mute dark:text-mute-dark">{meta}</div>
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
                  : 'bg-surface-alt text-text dark:bg-surface-dark-alt dark:text-mute-dark'
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
