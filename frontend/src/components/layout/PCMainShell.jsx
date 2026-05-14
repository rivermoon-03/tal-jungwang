import MapView from '../map/MapView'
import MapLegendOnboarding from '../map/MapLegendOnboarding'
import useAppStore from '../../stores/useAppStore'

// PC 전용 메인 셸. 좌측 패널 영역(38%) + 우측 영구 지도(62%).
// children에는 페이지별 좌측 콘텐츠를 받는다.
// mapFullscreen이면 좌측 폭 0%로 transition. 지도는 절대 unmount 되지 않음.

export default function PCMainShell({ children }) {
  const mapFullscreen = useAppStore((s) => s.mapFullscreen)
  const selectedId = useAppStore((s) => s.selectedMarkerId)
  const setSelectedIdStore = useAppStore((s) => s.setSelectedMarkerId)
  const handleMarkerClick = (id) =>
    setSelectedIdStore(selectedId === id ? null : id)

  return (
    <div
      className="hidden md:grid w-full h-full transition-[grid-template-columns] duration-panel ease-snap"
      style={{
        gridTemplateColumns: mapFullscreen ? '0% 100%' : '38% 62%',
      }}
    >
      <aside className="relative overflow-y-auto bg-bg dark:bg-bg-dark min-w-0">
        <div
          className={`w-full h-full ${mapFullscreen ? 'opacity-0' : 'opacity-100'} transition-opacity duration-snap ease-ios`}
        >
          {children}
        </div>
      </aside>
      <section className="relative overflow-hidden">
        <MapView
          onMarkerClick={handleMarkerClick}
          selectedId={selectedId}
        />
        <MapLegendOnboarding />
      </section>
    </div>
  )
}
