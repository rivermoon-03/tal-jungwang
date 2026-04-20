/**
 * SegmentTabs — 분할형 탭(primary pill).
 * 디자인 번들 lib/components.jsx의 SegmentTabs를 React 컴포넌트화.
 *
 * Props:
 *   tabs              ([{ id, label, disabled?, title? }]) — 탭 정의
 *   active            (string)             — 현재 활성 id
 *   onChange          (id => void)         — 변경 핸들러
 *   onDisabledClick   (id => void)         — disabled 탭 클릭 시 호출(툴팁/토스트 등)
 *   size              ('sm'|'md')          — 기본 'md'
 *   className         (string)
 */
export default function SegmentTabs({ tabs, active, onChange, onDisabledClick, size = 'md', className = '' }) {
  const padY = size === 'sm' ? 7 : 10;
  const padX = size === 'sm' ? 12 : 16;
  const fontSize = size === 'sm' ? 12 : 13;

  return (
    <div
      role="tablist"
      className={className}
      style={{
        display: 'inline-flex',
        padding: 3,
        borderRadius: 999,
        background: 'var(--tj-bg-soft)',
        border: '1px solid var(--tj-line-soft)',
      }}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        const isDisabled = !!t.disabled;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            title={t.title}
            onClick={() => {
              if (isDisabled) onDisabledClick?.(t.id);
              else onChange?.(t.id);
            }}
            className={isDisabled ? '' : 'pressable'}
            style={{
              padding: `${padY}px ${padX}px`,
              borderRadius: 999,
              background: isActive ? 'var(--tj-pill-active-bg)' : 'transparent',
              color: isActive ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
              fontSize,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              lineHeight: 1,
              border: 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.4 : 1,
              transition: 'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios)',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
