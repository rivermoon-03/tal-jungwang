import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import MapView from './MapView'
import MapLegendOnboarding from './MapLegendOnboarding'
import Dashboard from '../dashboard/Dashboard'
import useAppStore from '../../stores/useAppStore'

const MODE_LABEL = { bus: '버스', subway: '지하철', shuttle: '셔틀', taxi: '택시' }

export default function MainTab() {
  const [selectedId, setSelectedId] = useState(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const selectedMode = useAppStore((s) => s.selectedMode)

  return (
    <div className="relative h-full w-full">
      <MapView
        onMarkerClick={(id) => setSelectedId((prev) => (prev === id ? null : id))}
        selectedId={selectedId}
      />

      <MapLegendOnboarding />

      {/* PC 전용 플로팅 대시보드 — 모바일은 MainShell이 담당 */}
      <div className="hidden md:block absolute bottom-4 left-4 z-[40]">
        {!isCollapsed ? (
          <div className="w-[414px] rounded-2xl shadow-lg overflow-hidden bg-white dark:bg-surface-dark">
            {/* 접기 버튼 헤더 */}
            <div className="flex justify-center py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsCollapsed(true)}
                aria-label="대시보드 접기"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
              >
                <ChevronDown size={14} className="text-slate-600 dark:text-slate-300" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">접기</span>
              </button>
            </div>
            {/* Dashboard — h-[390px] 로 section의 h-full이 정확히 계산됨 */}
            <div className="h-[468px]">
              <Dashboard />
            </div>
          </div>
        ) : (
          /* 접힌 상태: 모드 배지 + 펼치기 버튼 */
          <button
            onClick={() => setIsCollapsed(false)}
            aria-label="대시보드 펼치기"
            className="flex items-center gap-2.5 bg-white dark:bg-surface-dark rounded-2xl px-5 py-3 shadow-xl hover:shadow-2xl transition-all border border-slate-200 dark:border-slate-700 hover:border-slate-300"
          >
            <span className="text-sm font-bold text-navy dark:text-accent-dark">
              {MODE_LABEL[selectedMode] ?? '교통'}
            </span>
            <span className="text-slate-300 dark:text-slate-600 text-base leading-none">|</span>
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <ChevronUp size={16} />
              <span className="text-xs font-medium">펼치기</span>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
