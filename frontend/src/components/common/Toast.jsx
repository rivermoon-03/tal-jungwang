import { useEffect, useRef } from 'react';

/**
 * Toast — slide-up bottom toast, auto-dismiss after 2.5s.
 * Respects prefers-reduced-motion: skips slide animation when motion is reduced.
 * Props:
 *   message   (string) toast text
 *   onDismiss (function) called when dismissed (auto or manual)
 *   duration  (number) ms before auto-dismiss, default 2500
 */
export default function Toast({ message, onDismiss, duration = 2500 }) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50',
        'bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium',
        'px-5 py-3 rounded-pill shadow-pill',
        'motion-safe:animate-toast-slide-up',
      ].join(' ')}
    >
      {message}
    </div>
  );
}
