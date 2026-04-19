/**
 * EmptyState — icon + title + desc + optional CTA button.
 * Props:
 *   icon      (ReactNode) Lucide icon element
 *   title     (string)
 *   desc      (string)
 *   ctaLabel  (string) optional CTA button label
 *   onCta     (function) optional CTA handler
 *   className (string) extra classes
 */
export default function EmptyState({ icon, title, desc, ctaLabel, onCta, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 px-6 text-center ${className}`}>
      {icon && (
        <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && (
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</p>
      )}
      {desc && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
      )}
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-1 px-4 py-2 text-xs font-semibold rounded-xl bg-accent dark:bg-accent-dark text-white active:scale-95 transition-transform"
          style={{ transition: 'transform 0.1s var(--ease-ios)' }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
