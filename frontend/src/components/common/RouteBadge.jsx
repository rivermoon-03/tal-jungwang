import { tjLineColor } from './lineColor'

function normalizeLabel(route) {
  if (!route) return '';
  if (route === '4호선') return '4';
  if (route === '수인분당' || route === '수인분당선') return '수인';
  if (route === '서해선') return '서해';
  const stripped = route.replace('셔틀', '');
  return stripped || route;
}

// tag variant 전용: '시흥33' → '33', '시흥1' → '1', 나머지는 그대로
function normalizeTagLabel(route) {
  if (!route) return '';
  const withoutSiheung = route.replace(/^시흥/, '');
  if (withoutSiheung !== route) return withoutSiheung;
  return normalizeLabel(route);
}

export default function RouteBadge({
  route,
  variant = 'badge',
  size = 'md',
  label,
  className = '',
}) {
  const color = tjLineColor(route);
  const display = label ?? (variant === 'tag' ? normalizeTagLabel(route) : normalizeLabel(route));

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

  if (variant === 'tag') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px 6px',
          borderRadius: 5,
          background: color,
          color: '#fff',
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {display}
      </span>
    );
  }

  // badge (default)
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
