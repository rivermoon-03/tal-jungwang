/**
 * SectionHeader — UPPERCASE 트래킹 라벨 + 우측 addon.
 * 디자인 번들 lib/components.jsx의 SectionHeader.
 *
 * Props:
 *   title     (string)     — 섹션 제목 (자동 대문자/트래킹)
 *   subtitle  (string)     — 우측 보조 텍스트 (선택)
 *   addon     (ReactNode)  — 우측 커스텀 노드 (subtitle 우선순위 위)
 *   className (string)
 */
export default function SectionHeader({ title, subtitle, addon, className = '' }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        margin: '14px 0 8px',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.12em',
          color: 'var(--tj-mute)',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {(addon || subtitle) && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--tj-mute-2)',
            letterSpacing: '0.04em',
          }}
        >
          {addon ?? subtitle}
        </span>
      )}
    </div>
  );
}
