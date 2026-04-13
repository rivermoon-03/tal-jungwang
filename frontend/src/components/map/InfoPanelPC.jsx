import { Info } from 'lucide-react'
import InfoPanelTabs from './InfoPanelTabs'

export default function InfoPanelPC({ tab, setTab, subwayData, busJeongwangData, walkSec, onInfoClick, isFirstVisit }) {
  return (
    <div className="absolute top-3 left-3 w-80 bg-white rounded-2xl shadow-xl p-4 z-10 pointer-events-auto">
      <InfoPanelTabs
        tab={tab}
        setTab={setTab}
        subwayData={subwayData}
        busJeongwangData={busJeongwangData}
        walkSec={walkSec}
      />
      <div className="flex justify-end mt-2">
        <button
          aria-label="정보"
          onClick={onInfoClick}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
            isFirstVisit
              ? 'info-btn-glow border-transparent text-white'
              : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Info size={14} />
        </button>
      </div>
    </div>
  )
}
