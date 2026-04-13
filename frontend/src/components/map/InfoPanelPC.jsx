import InfoPanelTabs from './InfoPanelTabs'

export default function InfoPanelPC({ tab, setTab, subwayData, busJeongwangData, walkSec }) {
  return (
    <div className="absolute top-3 left-3 w-80 bg-white rounded-2xl shadow-xl p-4 z-10 pointer-events-auto">
      <InfoPanelTabs
        tab={tab}
        setTab={setTab}
        subwayData={subwayData}
        busJeongwangData={busJeongwangData}
        walkSec={walkSec}
      />
    </div>
  )
}
