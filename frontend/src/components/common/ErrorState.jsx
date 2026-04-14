import { TriangleAlert } from 'lucide-react';

/**
 * ErrorState — warning icon + message + 다시 시도 button.
 * Props:
 *   message   (string) error description
 *   onRetry   (function) retry handler
 *   className (string) extra classes
 */
export default function ErrorState({ message, onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 px-6 text-center ${className}`}>
      <TriangleAlert size={32} className="text-coral" aria-hidden="true" />
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-4 py-2 text-xs font-semibold rounded-xl border border-coral text-coral active:scale-95 transition-transform"
          style={{ transition: 'transform 0.1s var(--ease-ios)' }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
