// 그룹 묶음 컨테이너. 헤더(uppercase ghdr) + 행들.
// 라이트: 흰 카드 + 그림자. 다크: #0a0a0a + 1px 헤어라인.
// 행 사이는 border-top: 1px solid var(--line).

export default function RouteGroup({ heading, children, className = '' }) {
  return (
    <section
      className={`rounded-card bg-surface shadow-card dark:bg-surface-dark dark:border dark:border-line-dark dark:shadow-none overflow-hidden ${className}`}
    >
      {heading && (
        <header className="px-3 pt-[7px] pb-[3px] text-ghdr uppercase text-mute dark:text-mute-dark">
          {heading}
        </header>
      )}
      <div className="flex flex-col">
        {children}
      </div>
    </section>
  )
}
