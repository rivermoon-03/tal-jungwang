import { useLayoutEffect, useRef, useState } from 'react';

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
 *
 * 활성 pill은 실제 버튼 위치/폭을 측정해 슬라이드하는 단일 인디케이터로 구현
 * (DESIGN.md §4 "세그먼트 인디케이터 슬라이드" — e-out/dur-motion-base).
 */
export default function SegmentTabs({ tabs, active, onChange, onDisabledClick, size = 'md', className = '' }) {
  const padY = size === 'sm' ? 7 : 10;
  const padX = size === 'sm' ? 12 : 16;
  const fontSize = size === 'sm' ? 12 : 13;

  const containerRef = useRef(null);
  const btnRefs = useRef(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // 컨테이너 폭/폰트가 나중에 정착해도 인디케이터가 stale해지지 않게 재측정한다
  // (ui/SegmentTabs와 동일 — 마운트 1회 측정만 하면 활성 탭과 어긋난다).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const btn = btnRefs.current.get(active);
      if (!container || !btn) return;
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicator({ left: bRect.left - cRect.left, width: bRect.width, ready: true });
    };
    measure();

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(container);
    }
    let cancelled = false;
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!cancelled) measure(); });

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
    };
  }, [active, tabs]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        padding: 3,
        borderRadius: 999,
        background: 'var(--tj-bg-soft)',
        border: '1px solid var(--tj-line-soft)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: 0,
          borderRadius: 999,
          background: 'var(--tj-pill-active-bg)',
          width: indicator.width,
          transform: `translateX(${indicator.left}px)`,
          transition: 'transform var(--dur-motion-base) var(--e-out), width var(--dur-motion-base) var(--e-out)',
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {tabs.map((t) => {
        const isActive = t.id === active;
        const isDisabled = !!t.disabled;
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) btnRefs.current.set(t.id, el);
              else btnRefs.current.delete(t.id);
            }}
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
              position: 'relative',
              zIndex: 1,
              padding: `${padY}px ${padX}px`,
              borderRadius: 999,
              background: 'transparent',
              color: isActive ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
              fontSize,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              lineHeight: 1,
              border: 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.4 : 1,
              transition: 'color var(--dur-motion-base) var(--e-out)',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
