/**
 * PageHeader — 모든 서브 페이지 공통 헤더.
 */
export default function PageHeader({ title, subtitle }) {
  return (
    <header className="px-4 pt-[14px] pb-[10px] bg-transparent">
      <h1
        className="text-ink dark:text-white"
        style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em' }}
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
