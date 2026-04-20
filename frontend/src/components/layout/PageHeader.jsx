/**
 * PageHeader — 모든 서브 페이지 공통 헤더.
 * 디자인 번들 정렬: title text-display (18px/900), subtitle text-caption (11px/500).
 */
export default function PageHeader({ title, subtitle }) {
  return (
    <header className="px-4 pt-[14px] pb-[10px] bg-transparent">
      <h1
        className="text-display text-ink dark:text-white"
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="mt-0.5 text-caption text-mute"
          style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          {subtitle}
        </p>
      )}
    </header>
  )
}
