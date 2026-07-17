/**
 * Skeleton — shimmer placeholder block.
 * Props:
 *   width    (string | number) default '100%'
 *   height   (string | number) default '1rem'
 *   rounded  (string) Tailwind rounded class, default 'rounded-md'
 *   className (string) extra classes
 *
 * Accessibility: prefers-reduced-motion 환경에서 animate-pulse 정지
 * (Tailwind motion-reduce:animate-none)
 */
export default function Skeleton({ width = '100%', height = '1rem', rounded = 'rounded-md', className = '' }) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none bg-surface-2 ${rounded} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
