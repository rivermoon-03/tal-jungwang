/**
 * RouteBadge — 노선 식별 배지(단일 소스).
 * 디자인 번들 lib/components.jsx의 RouteBadge를 React 컴포넌트화.
 *
 * Props:
 *   route   (string)              — 노선명. 예: '20-1', '시흥33', '4호선', '등교셔틀'
 *   variant ('dot'|'chip'|'badge') — 표시 형태. 기본 'badge'
 *   size    ('sm'|'md')           — 크기. 기본 'md'
 *   label   (string)              — 표시 라벨 override (선택)
 *   className (string)            — 추가 클래스
 */

import { tjLineColor } from './lineColor'

function normalizeLabel(route) {
  if (!route) return '';
  if (route === '4호선') return '4';
  if (route === '수인분당' || route === '수인분당선') return '수인';
  if (route === '서해선') return '서해';
  // '등교셔틀'·'하교셔틀'처럼 접미어면 떼어내고, 치환 결과가 비면 원문을 그대로 쓴다.
  const stripped = route.replace('셔틀', '');
  return stripped || route;
}

export default function RouteBadge({
  route,
  variant = 'badge',
  size = 'md',
  label,
  className = '',
}) {
  const color = tjLineColor(route);
  const display = label ?? normalizeLabel(route);

  if (variant === 'dot') {
    const d = size === 'sm' ? 8 : 10;
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{
          display: 'inline-block',
          width: d,
          height: d,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />
    );
  }

  if (variant === 'chip') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: size === 'sm' ? '1.5px 7px' : '2px 8px',
          borderRadius: 999,
          background: color,
          color: '#fff',
          fontSize: size === 'sm' ? 10 : 11,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {display}
      </span>
    );
  }

  // badge (default) — 정사각/약간 wide. 다중 글자 자동 패딩.
  const sz = size === 'sm' ? 30 : 36;
  const fs = size === 'sm' ? 11 : 13;
  const isWide = (display?.length ?? 0) >= 3;
  const px = isWide ? (size === 'sm' ? 6 : 8) : 0;

  return (
    <span
      className={className}
      style={{
        minWidth: sz,
        height: sz,
        padding: `0 ${px}px`,
        borderRadius: 10,
        background: color,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fs,
        fontWeight: 900,
        letterSpacing: '-0.02em',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  );
}
