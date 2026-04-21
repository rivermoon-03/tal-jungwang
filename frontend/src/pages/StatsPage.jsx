import PageHeader from '../components/layout/PageHeader'
import CrowdingCard from '../components/stats/CrowdingCard'
import TrafficFlowCard from '../components/stats/TrafficFlowCard'
import WeatherCard from '../components/stats/WeatherCard'

export default function StatsPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark animate-fade-in-up">
      <PageHeader title="통계" subtitle="교통 이용 통계" />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:pb-6">
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          데이터 수집 중인 기능입니다
        </div>
        <div className="space-y-4">
          <WeatherCard />
          <TrafficFlowCard />
          <CrowdingCard />
        </div>
      </div>
    </div>
  )
}
