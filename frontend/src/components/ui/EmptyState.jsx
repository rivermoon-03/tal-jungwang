/**
 * EmptyState — icon + title + desc + optional nextInfo card + optional action button.
 * "답이 있는 빈 상태"(스펙 예시 10): 그냥 "없음"이 아니라 다음 행동을 안내한다.
 *
 * Props:
 *   icon        (ReactNode) Lucide icon 또는 MascotDot 같은 장식 SVG — optional
 *   altText     (string) icon에 부여할 접근성 대체 텍스트. 없으면 icon은 순수 장식(aria-hidden)
 *   title       (string) 제목 text-head(17px) text-ink
 *   desc        (string) 설명 text-body(15px) text-mute
 *   nextInfo    ({ label, time, sub }) 다음 운행 안내 카드
 *               (예: { label: '내일 첫차', time: '07:40', sub: '정왕역 출발' })
 *   action      ({ label: string, onClick: fn }) 선택적 액션 버튼 (레거시 형태, 계속 지원)
 *   actionLabel (string) action의 분리형 — onAction과 함께 쓴다
 *   onAction    (fn) actionLabel과 짝. 없으면 버튼 미표시
 *   className   (string) extra classes
 */
export default function EmptyState({
  icon,
  altText,
  title,
  desc,
  nextInfo = null,
  action,
  actionLabel,
  onAction,
  className = '',
}) {
  // action(레거시 객체형)이 있으면 그대로 쓰고, 없으면 actionLabel/onAction 조합으로 구성.
  const resolvedAction = action ?? (onAction ? { label: actionLabel, onClick: onAction } : null)

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 px-6 text-center ${className}`}
    >
      {icon && (
        <span
          className="text-mute"
          aria-hidden={altText ? undefined : 'true'}
          aria-label={altText || undefined}
        >
          {icon}
        </span>
      )}
      {title && (
        <p className="text-head font-bold text-ink">{title}</p>
      )}
      {desc && (
        <p className="text-body text-mute">{desc}</p>
      )}
      {nextInfo && (nextInfo.label || nextInfo.time || nextInfo.sub) && (
        <div className="mt-1 min-w-[140px] flex flex-col items-center gap-0.5 rounded-card border border-line bg-surface-2 px-4 py-2.5">
          {nextInfo.label && (
            <span className="text-caption font-bold text-mute">{nextInfo.label}</span>
          )}
          {nextInfo.time && (
            <span className="text-head font-bold text-ink tabular-nums">{nextInfo.time}</span>
          )}
          {nextInfo.sub && (
            <span className="text-label text-mute">{nextInfo.sub}</span>
          )}
        </div>
      )}
      {resolvedAction && (
        <button
          type="button"
          onClick={resolvedAction.onClick}
          className="mt-1 px-5 min-h-[40px] text-caption font-bold rounded-btn bg-surface-2 text-mute active:scale-[0.94] transition-transform duration-press ease-spring"
        >
          {resolvedAction.label}
        </button>
      )}
    </div>
  )
}
