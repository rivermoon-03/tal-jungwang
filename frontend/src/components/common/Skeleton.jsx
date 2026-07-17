/**
 * Skeleton — shimmer placeholder block.
 * Props:
 *   width    (string | number) default '100%'
 *   height   (string | number) default '1rem'
 *   rounded  (string) Tailwind rounded class, default 'rounded-md'
 *   className (string) extra classes
 *
 * Phase C: 단색 animate-pulse(불투명도만 변화) 대신 그라디언트 스윕 시머(.tj-skeleton,
 * DESIGN.md §4)를 사용. Accessibility: prefers-reduced-motion 환경에서는 전역
 * `*::before,*::after{animation-duration:.01ms!important}` 규칙으로 자동 무력화.
 */
export default function Skeleton({ width = '100%', height = '1rem', rounded = 'rounded-md', className = '' }) {
  return (
    <div
      className={`tj-skeleton ${rounded} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
