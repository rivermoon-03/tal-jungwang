/**
 * ArrivalRow — 도착 정보 공용 행 컴포넌트.
 *
 * Props:
 *   routeColor: string         노선 색 (dot 배경으로 사용)
 *   routeNumber: string        노선 번호 / 호선 이름
 *   direction?: string         방향 / 행선지 (서브 텍스트)
 *   minutes: number | null     남은 분. null이면 "운행 정보 없음" 표시
 *   isUrgent?: boolean         true면 좌측 3px accent border
 *   onClick?: () => void       행 탭 핸들러 (호출자 책임)
 *   rightAddon?: ReactNode     우측 끝에 붙일 추가 요소 (예: 배지)
 *
 * 전체가 <button> 이며, pressable 피드백이 적용된다.
 */
export default function ArrivalRow({
  routeColor,
  routeNumber,
  direction,
  minutes,
  isUrgent = false,
  onClick,
  rightAddon = null,
}) {
  const hasMinutes = minutes != null && Number.isFinite(minutes)

  return (
    <button
      type="button"
      onClick={onClick}
      data-urgent={isUrgent ? 'true' : 'false'}
      className={[
        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left',
        'bg-gray-50 dark:bg-surface-dark/60',
        'pressable transition-colors duration-press',
      ].join(' ')}
      style={{
        borderLeft: `3px solid ${isUrgent ? '#102c4c' : 'transparent'}`,
      }}
    >
      {/* 노선 색 dot */}
      <span
        aria-hidden="true"
        className="block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: routeColor || '#6b7280' }}
      />

      {/* 노선 번호 + 방향 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-body text-ink dark:text-white truncate">
          {routeNumber}
        </span>
        {direction ? (
          <span className="text-caption text-mute truncate">{direction}</span>
        ) : null}
      </div>

      {/* 우측: 남은 분 또는 "운행 정보 없음" */}
      <div className="flex items-center gap-2 shrink-0">
        {hasMinutes ? (
          <div className="flex items-baseline gap-0.5">
            <span className="text-display text-ink dark:text-white">
              {minutes}
            </span>
            <span className="text-caption text-mute">분</span>
          </div>
        ) : (
          <span className="text-caption text-mute">운행 정보 없음</span>
        )}
        {rightAddon}
      </div>
    </button>
  )
}
