/**
 * Skeleton — shimmer placeholder block.
 * Props:
 *   w         (string | number) width, default '100%'
 *   h         (string | number) height, default '1rem'
 *   rounded   (string) Tailwind rounded class, default 'rounded-md'
 *   className (string) extra classes
 *
 * Accessibility: prefers-reduced-motion 환경에서 animate-pulse 정지
 * (Tailwind motion-reduce:animate-none)
 */
export default function Skeleton({ w = '100%', h = '1rem', rounded = 'rounded-md', className = '' }) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none bg-surface-2 ${rounded} ${className}`}
      style={{ width: w, height: h }}
      aria-hidden="true"
    />
  )
}
