/**
 * EmptyState — icon + title + desc + optional action button.
 * Props:
 *   icon      (ReactNode) Lucide icon element — optional
 *   title     (string) 제목 text-head(17px) text-ink
 *   desc      (string) 설명 text-body(15px) text-mute
 *   action    ({ label: string, onClick: fn }) 선택적 액션 버튼
 *   className (string) extra classes
 */
export default function EmptyState({ icon, title, desc, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 px-6 text-center ${className}`}
    >
      {icon && (
        <span className="text-mute" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && (
        <p className="text-head font-bold text-ink">{title}</p>
      )}
      {desc && (
        <p className="text-body text-mute">{desc}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 px-5 min-h-[40px] text-caption font-bold rounded-btn bg-surface-2 text-mute active:scale-[0.94] transition-transform duration-press ease-spring"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
