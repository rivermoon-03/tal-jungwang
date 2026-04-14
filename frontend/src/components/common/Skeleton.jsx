/**
 * Skeleton — shimmer placeholder block.
 * Props:
 *   width    (string | number) default '100%'
 *   height   (string | number) default '1rem'
 *   rounded  (string) Tailwind rounded class, default 'rounded-md'
 *   className (string) extra classes
 */
export default function Skeleton({ width = '100%', height = '1rem', rounded = 'rounded-md', className = '' }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${rounded} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
