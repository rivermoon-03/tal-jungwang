import { TriangleAlert } from 'lucide-react'

/**
 * ErrorState — warning icon + message + optional 다시 시도 button.
 * Props:
 *   message   (string) error description — text-body text-ink
 *   onRetry   (function) retry handler — button visible only when provided
 *   className (string) extra classes
 */
export default function ErrorState({ message, onRetry, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 px-6 text-center ${className}`}
    >
      <TriangleAlert size={32} className="text-mute" aria-hidden="true" />
      {message && (
        <p className="text-body text-ink">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-6 min-h-[44px] text-body font-bold rounded-btn bg-accent text-white active:scale-[0.94] transition-transform duration-press ease-spring"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
