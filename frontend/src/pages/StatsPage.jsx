import PageHeader from '../components/layout/PageHeader'
import StatusChips from '../components/stats/StatusChips'
import TrafficFlowCard from '../components/stats/TrafficFlowCard'
import CrowdingCard from '../components/stats/CrowdingCard'
import WeatherCard from '../components/stats/WeatherCard'

export default function StatsPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark animate-fade-in-up">
      <PageHeader title="오늘의 교통" subtitle="지금 · 이후 흐름" />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:pb-6">
        <StatusChips />
        <div className="space-y-4">
          <TrafficFlowCard />
          <CrowdingCard />
          <WeatherCard />
        </div>
        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
          교통 흐름 · 혼잡도는 과거 데이터 기반 예측입니다
        </p>
      </div>
    </div>
  )
}
