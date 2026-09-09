/**
 * Skeleton — shimmer placeholder block.
 * Props:
 *   width    (string | number) default '100%'
 *   height   (string | number) default '1rem'
 *   rounded  (string) Tailwind rounded class, default 'rounded-button'
 *   className (string) extra classes
 *
 * Phase C: 단색 animate-pulse(불투명도만 변화) 대신 그라디언트 스윕 시머(.tj-skeleton,
 * DESIGN.md §4)를 사용. Accessibility: prefers-reduced-motion 환경에서는 전역
 * `*::before,*::after{animation-duration:.01ms!important}` 규칙으로 자동 무력화.
 *
 * F1-4(레이아웃 시프트 0): 범용 Skeleton 외에, 실제 카드와 골격(높이/radius/행 구성)이
 * 1:1 대응하는 변형을 이 파일에서 함께 export한다.
 *   - SkeletonArrivalCard: TransitCard(도착 카드) 대응
 *   - SkeletonPanelRow: SubwayPanel/ShuttlePanel의 듀얼 컬럼(좌우 방향) 카드 대응.
 *     예전엔 DualDirectionCard가 그 실제 카드였지만 TransitCard로 대체되며
 *     삭제됐다(결함 #4, 2026-08). 로딩 스켈레톤 모양 자체는 그대로 유효해 남긴다.
 */
export default function Skeleton({ width = '100%', height = '1rem', rounded = 'rounded-button', className = '' }) {
  return (
    <div
      className={`tj-skeleton ${rounded} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * SkeletonArrivalCard — TransitCard(components/ui/TransitCard.jsx)와 동일한
 * 골격의 로딩 자리표시자.
 *
 * 레이아웃 시프트 0을 위해 실제 카드와 같은 셸 클래스(rounded-card p-3
 * bg-surface shadow-sh-card)와 같은 그리드 트랙을 그대로 공유한다.
 */
export function SkeletonArrivalCard({ className = '' }) {
  return (
    <div
      className={`rounded-card p-3 bg-surface shadow-sh-card ${className}`}
      aria-hidden="true"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        {/* 좌: 노선 타일 56px (RouteBadge variant="tile"와 동일 치수) */}
        <div className="tj-skeleton rounded-tile w-14 h-14 shrink-0" />

        {/* 중앙: 제목 1줄 + 칩 행 1줄 */}
        <div className="min-w-0 space-y-2">
          <div className="tj-skeleton rounded-button h-4 w-3/5" />
          <div className="tj-skeleton rounded-button h-3 w-2/5" />
        </div>

        {/* 우: 상대시간 + 보조 캡션 — 실제 카드가 항상 두 줄을 예약한다 */}
        <div className="shrink-0 flex flex-col items-end gap-1 min-h-[44px] justify-center">
          <div className="tj-skeleton rounded-button h-6 w-12" />
          <div className="tj-skeleton rounded-button h-3 w-9" />
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonPanelRow — SubwayPanel/ShuttlePanel이 쓰는 좌우 듀얼 컬럼 카드에
 * 대응하는 로딩 자리표시자.
 *
 * 헤더(원형 심볼 + 노선명) + 세로 구분선을 사이에 둔 좌/우 컬럼(라벨 → 큰 숫자 →
 * 진행바) 구조를 그대로 재현해 실제 카드와 총 높이가 근접하도록 한다.
 */
export function SkeletonPanelRow({ className = '' }) {
  return (
    <div
      className={`rounded-card p-[18px] bg-surface border border-line ${className}`}
      aria-hidden="true"
    >
      {/* 헤더: 원형 심볼 + 노선명 */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="tj-skeleton rounded-full w-[22px] h-[22px] shrink-0" />
        <div className="tj-skeleton rounded-button h-4 w-16" />
      </div>

      {/* 듀얼 컬럼: 좌(상행/등교) · 세로 구분선 · 우(하행/하교) */}
      <div className="grid grid-cols-[1fr_1px_1fr] items-start">
        <div className="px-1 py-1.5 space-y-2">
          <div className="tj-skeleton rounded-button h-3 w-12" />
          <div className="tj-skeleton rounded-button h-9 w-14" />
          <div className="tj-skeleton rounded-pill h-1 w-full" />
        </div>
        <div className="bg-line" aria-hidden="true" />
        <div className="px-1 py-1.5 space-y-2 flex flex-col items-end">
          <div className="tj-skeleton rounded-button h-3 w-12" />
          <div className="tj-skeleton rounded-button h-9 w-14" />
          <div className="tj-skeleton rounded-pill h-1 w-full" />
        </div>
      </div>
    </div>
  );
}
