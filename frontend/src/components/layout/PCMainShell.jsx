import MapView from '../map/MapView'
import MapLegendOnboarding from '../map/MapLegendOnboarding'
import useAppStore from '../../stores/useAppStore'

// PC 전용 메인 셸. 지도 홈(children=PCMapDashboard)에서는 좌측 패널(38%) + 우측
// 영구 지도(62%) 2분할. 그 외 페이지(시간표·학식·더보기 등)는 지도를 시각적으로
// 숨기고 콘텐츠가 전체 폭을 쓴다 — "PC·시간표"/"PC·설정" 시안은 지도 없이 자체
// 2열 레이아웃(리스트+상세, nav+content)을 쓰기 때문.
// 지도(MapView)는 showMap=false여도 절대 unmount 하지 않는다(GPS watch·타일 캐시가
// 죽지 않게) — 폭만 0으로 접어 화면 밖으로 보낸다.
export default function PCMainShell({ children, showMap = true }) {
  const mapFullscreen = useAppStore((s) => s.mapFullscreen)
  const selectedId = useAppStore((s) => s.selectedMarkerId)
  const setSelectedIdStore = useAppStore((s) => s.setSelectedMarkerId)
  const handleMarkerClick = (id) =>
    setSelectedIdStore(selectedId === id ? null : id)

  const columns = !showMap
    ? '100% 0%'
    : (mapFullscreen ? '0% 100%' : '38% 62%')
  const contentHidden = showMap && mapFullscreen

  return (
    <div
      className="hidden md:grid w-full h-full transition-[grid-template-columns] duration-panel ease-out"
      style={{ gridTemplateColumns: columns }}
    >
      <aside className="relative overflow-y-auto bg-bg dark:bg-bg min-w-0">
        <div
          className={`w-full h-full ${contentHidden ? 'opacity-0' : 'opacity-100'} transition-opacity duration-snap ease-inout`}
        >
          {children}
        </div>
      </aside>
      <section className="relative overflow-hidden" aria-hidden={!showMap}>
        <MapView
          onMarkerClick={handleMarkerClick}
          selectedId={selectedId}
        />
        {showMap && <MapLegendOnboarding />}
      </section>
    </div>
  )
}
