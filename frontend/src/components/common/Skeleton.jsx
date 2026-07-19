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
 *
 * F1-4(레이아웃 시프트 0): 범용 Skeleton 외에, 실제 카드와 골격(높이/radius/행 구성)이
 * 1:1 대응하는 변형을 이 파일에서 함께 export한다.
 *   - SkeletonArrivalCard: ArrivalRow(버스 도착 행) 대응
 *   - SkeletonPanelRow: DualDirectionCard(지하철/셔틀 듀얼 컬럼 카드) 대응
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

/**
 * SkeletonArrivalCard — ArrivalRow(components/dashboard/ArrivalRow.jsx)와
 * 동일한 골격의 로딩 자리표시자.
 *
 * 레이아웃 시프트 0을 위해 실제 카드와 같은 컨테이너 클래스(rounded-card p-4,
 * bg-surface border border-line)를 그대로 공유한다. 내부는 실제 카드의 3분할
 * (좌: 노선 뱃지 / 중앙: 제목 2줄 / 우: 큰 숫자)을 그대로 흉내낸다.
 */
export function SkeletonArrivalCard({ className = '' }) {
  return (
    <div
      className={`rounded-card p-4 bg-surface border border-line ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        {/* 좌: 노선번호 뱃지 자리 (RouteBadge와 동일 radius) */}
        <div className="tj-skeleton rounded-badge w-10 h-6 shrink-0" />

        {/* 중앙: 제목(본문) 1줄 + 부제(캡션) 1줄 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="tj-skeleton rounded-md h-4 w-3/5" />
          <div className="tj-skeleton rounded-md h-3 w-2/5" />
        </div>

        {/* 우: 큰 숫자(ETA) 자리 */}
        <div className="flex-shrink-0">
          <div className="tj-skeleton rounded-md h-7 w-11" />
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonPanelRow — DualDirectionCard(components/common/DualDirectionCard.jsx)와
 * 동일한 골격의 로딩 자리표시자. SubwayPanel/ShuttlePanel이 쓰는 좌우 듀얼 컬럼
 * 카드에 대응한다.
 *
 * 헤더(원형 심볼 + 노선명) + 세로 구분선을 사이에 둔 좌/우 컬럼(라벨 → 큰 숫자 →
 * 진행바) 구조를 그대로 재현해 실제 카드와 총 높이가 근접하도록 한다.
 */
export function SkeletonPanelRow({ className = '' }) {
  return (
    <div
      className={`rounded-card p-4 bg-surface border border-line ${className}`}
      aria-hidden="true"
    >
      {/* 헤더: 원형 심볼 + 노선명 */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="tj-skeleton rounded-full w-[22px] h-[22px] shrink-0" />
        <div className="tj-skeleton rounded-md h-4 w-16" />
      </div>

      {/* 듀얼 컬럼: 좌(상행/등교) · 세로 구분선 · 우(하행/하교) */}
      <div className="grid grid-cols-[1fr_1px_1fr] items-start">
        <div className="px-1 py-1.5 space-y-2">
          <div className="tj-skeleton rounded-md h-3 w-12" />
          <div className="tj-skeleton rounded-md h-9 w-14" />
          <div className="tj-skeleton rounded-pill h-1 w-full" />
        </div>
        <div className="bg-line" aria-hidden="true" />
        <div className="px-1 py-1.5 space-y-2 flex flex-col items-end">
          <div className="tj-skeleton rounded-md h-3 w-12" />
          <div className="tj-skeleton rounded-md h-9 w-14" />
          <div className="tj-skeleton rounded-pill h-1 w-full" />
        </div>
      </div>
    </div>
  );
}
