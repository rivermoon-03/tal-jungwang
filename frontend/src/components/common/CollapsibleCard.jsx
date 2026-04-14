import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * CollapsibleCard — wrapper with collapsed/expanded states.
 * Height + opacity 0.3s transition; honors prefers-reduced-motion.
 *
 * Props:
 *   collapsed        (boolean) current collapsed state
 *   onToggle         (function) toggle handler
 *   collapsedContent (ReactNode) content shown when collapsed
 *   children         (ReactNode) full content shown when expanded
 *   className        (string) extra wrapper classes
 */
export default function CollapsibleCard({ collapsed, onToggle, collapsedContent, children, className = '' }) {
  return (
    <div className={`rounded-card bg-white dark:bg-surface-dark shadow-card overflow-hidden ${className}`}>
      {/* Toggle header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle?.()}
      >
        <div className="flex-1 min-w-0">
          {collapsed ? collapsedContent : null}
        </div>
        <span className="ml-2 text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true">
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </div>

      {/* Expandable body */}
      <div
        className="motion-safe:transition-all motion-safe:duration-300"
        style={{
          maxHeight: collapsed ? 0 : '1000px',
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
          transition: 'max-height 0.3s var(--ease-ios), opacity 0.3s var(--ease-ios)',
        }}
        aria-hidden={collapsed}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
