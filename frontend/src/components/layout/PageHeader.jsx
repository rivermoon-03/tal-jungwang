/**
 * PageHeader — 모든 서브 페이지 공통 헤더.
 * action: 제목 우측에 붙는 액션 요소(예: 더보기의 설정 진입 버튼). 없으면 기존 그대로.
 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <header className="px-4 pt-[14px] pb-[10px] bg-transparent">
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-ink dark:text-white"
          style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.03em' }}
        >
          {title}
        </h1>
        {action}
      </div>
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
