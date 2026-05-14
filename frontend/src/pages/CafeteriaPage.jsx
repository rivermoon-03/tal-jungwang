/**
 * CafeteriaPage — /cafeteria 페이지 (학식)
 * TODO: 식단표 컨텐츠 채우기.
 */
import PageHeader from '../components/layout/PageHeader'

export default function CafeteriaPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark animate-fade-in-up">
      <PageHeader title="학식" subtitle="오늘의 식단" />
      <div className="flex-1 flex items-center justify-center px-4 pb-28 md:pb-6">
        <p className="text-center text-sm text-slate-400 dark:text-slate-500">
          준비 중입니다
        </p>
      </div>
    </div>
  )
}
