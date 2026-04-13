import { useState } from 'react'
import { Info, ChevronUp } from 'lucide-react'
import InfoPanelTabs from './InfoPanelTabs'

export default function InfoPanelPC({ tab, setTab, subwayData, busJeongwangData, walkTimes, timetableData, onInfoClick, isFirstVisit }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="absolute top-3 left-3 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl z-10 pointer-events-auto overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">교통 정보</span>
        <div className="flex items-center gap-1.5">
          <button
            aria-label="정보"
            onClick={onInfoClick}
            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
              isFirstVisit
                ? 'info-btn-glow border-transparent text-white'
                : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <Info size={14} />
          </button>
          <button
            aria-label={collapsed ? '펼치기' : '접기'}
            onClick={() => setCollapsed((v) => !v)}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <ChevronUp size={14} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {!collapsed && (
        <div className="p-4">
          <InfoPanelTabs
            tab={tab}
            setTab={setTab}
            subwayData={subwayData}
            busJeongwangData={busJeongwangData}
            walkTimes={walkTimes}
            timetableData={timetableData}
          />
        </div>
      )}
    </div>
  )
}
