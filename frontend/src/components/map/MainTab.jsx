import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import MapView from './MapView'
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

      {/* PC 전용 플로팅 대시보드 — 모바일은 MainShell이 담당 */}
      <div className="hidden md:block absolute bottom-4 left-4 z-[40]">
        {!isCollapsed ? (
          <div className="w-72 rounded-2xl shadow-lg overflow-hidden bg-white dark:bg-surface-dark">
            {/* 접기 버튼 헤더 */}
            <div className="flex justify-end px-2 py-1 border-b border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setIsCollapsed(true)}
                aria-label="대시보드 접기"
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronDown size={13} className="text-slate-400" />
              </button>
            </div>
            {/* Dashboard — h-[390px] 로 section의 h-full이 정확히 계산됨 */}
            <div className="h-[390px]">
              <Dashboard />
            </div>
          </div>
        ) : (
          /* 접힌 상태: 모드 배지 + 펼치기 버튼 */
          <button
            onClick={() => setIsCollapsed(false)}
            aria-label="대시보드 펼치기"
            className="flex items-center gap-2 bg-white dark:bg-surface-dark rounded-xl px-3 py-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            <span className="text-xs font-semibold text-navy">
              {MODE_LABEL[selectedMode] ?? '교통'}
            </span>
            <ChevronUp size={13} className="text-slate-400" />
          </button>
        )}
      </div>
    </div>
  )
}
