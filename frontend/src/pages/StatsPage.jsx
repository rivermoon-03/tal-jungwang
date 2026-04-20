import PageHeader from '../components/layout/PageHeader'

export default function StatsPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark">
      <PageHeader title="통계" subtitle="교통 이용 통계" />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">준비 중입니다</p>
      </div>
    </div>
  )
}
