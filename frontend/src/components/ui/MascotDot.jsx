/**
 * MascotDot — 잠든 버스를 표현하는 작은 도트 마스코트 SVG.
 * "답이 있는 빈 상태"(운행 종료 등)에서만 쓰는 장식 아이콘.
 * 이모지 대신 심플한 도형(몸체 + 바퀴 + zzz 곡선 하나)으로 구성한다.
 * 색은 디자인 토큰(var(--tj-accent*))만 사용.
 */
export default function MascotDot({ className = '' }) {
  return (
    <svg
      width="40"
      height="28"
      viewBox="0 0 40 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* 버스 몸체 */}
      <rect
        x="3"
        y="6"
        width="27"
        height="14"
        rx="5"
        fill="var(--tj-accent-bg)"
        stroke="var(--tj-accent)"
        strokeWidth="1.5"
      />
      {/* 바퀴 */}
      <circle cx="11" cy="21" r="3" fill="var(--tj-accent)" />
      <circle cx="24" cy="21" r="3" fill="var(--tj-accent)" />
      {/* zzz — 졸음을 표현하는 곡선 하나 */}
      <path
        d="M28 5c2-1.5 5-1.5 7 0"
        stroke="var(--tj-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
