import BusPanel from '../summary/BusPanel'
import ShuttlePanel from '../summary/ShuttlePanel'
import SubwayPanel from '../summary/SubwayPanel'
import PCStationPicker from './PCStationPicker'

// PC 전용 지도 페이지 좌측 대시보드.
// 상단: PCStationPicker (Glass Map 카드 + 정류장 chip row + 등교/하교 토글)
// 좌상(60%): 버스 도착 — BusPanel 그대로 (정류장 상태 공유).
// 좌하(40%): 셔틀 + 지하철 2열 그리드.
// 모바일은 Dashboard(기존 ModeTabs로 토글)를 그대로 사용.

export default function PCMapDashboard() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PCStationPicker />

      <section className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        <BusPanel />
      </section>

      <section className="shrink-0 grid grid-cols-2 gap-2 px-3 pb-3 border-t border-line dark:border-line-dark pt-2 h-[36%] overflow-hidden">
        <div className="overflow-y-auto">
          <ShuttlePanel />
        </div>
        <div className="overflow-y-auto">
          <SubwayPanel />
        </div>
      </section>
    </div>
  )
}
