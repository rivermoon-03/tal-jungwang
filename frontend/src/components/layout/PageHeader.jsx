/**
 * PageHeader — OneUI 스타일 대형 볼드 헤더 (좌상단)
 * Favorites / Schedule / More 페이지 상단에 공통으로 사용.
 */
export default function PageHeader({ title, subtitle }) {
  return (
    <header className="px-5 pt-6 pb-3 bg-transparent">
      <h1
        className="text-[28px] font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight"
        style={{ fontWeight: 900 }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </header>
  )
}
