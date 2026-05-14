import BusPanel from '../summary/BusPanel'
import ShuttlePanel from '../summary/ShuttlePanel'
import SubwayPanel from '../summary/SubwayPanel'
import useAppStore from '../../stores/useAppStore'

// PC 전용 지도 페이지 좌측 대시보드.
// 좌상(60%): 버스 도착 — BusPanel 그대로.
// 좌하(40%): 셔틀 + 지하철 2열 그리드.
// 모바일은 Dashboard(기존 ModeTabs로 토글)를 그대로 사용.

export default function PCMapDashboard() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-4 pt-4 pb-2 shrink-0">
        <div className="text-sub uppercase font-bold text-mute dark:text-mute-dark tracking-[0.1em]">
          {selectedBusStation}
        </div>
        <h1 className="text-panel-ttl text-ink dark:text-ink-dark">대시보드</h1>
      </header>

      {/* 좌상: 버스 (flex 1 — 위쪽 차지) */}
      <section className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        <BusPanel />
      </section>

      {/* 좌하: 셔틀 + 지하철 (높이 고정 — 약 40%) */}
      <section className="shrink-0 grid grid-cols-2 gap-2 px-3 pb-3 border-t border-line dark:border-line-dark pt-2 h-[40%] overflow-hidden">
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
