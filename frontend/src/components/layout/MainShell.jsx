import { Map } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import MapView from '../map/MapView'
import Dashboard from '../dashboard/Dashboard'

/**
 * MainShell — 모바일 전용 레이아웃 셸 (시안2).
 *
 * 구조 (세로):
 *   컴팩트 지도 띠 (~110px) + 우측 [지도] 확장 버튼
 *   Dashboard (정보 전체 — 모드탭·정류장칩·도착카드)
 *
 * 지도 확장 버튼 클릭 → mapExpanded=true → 지도가 전체 화면.
 * 기존 2단 스냅(SnapHandle/useSnap) 제거.
 *
 * md:hidden — 모바일 전용. PC는 PCMainShell에서 별도 처리.
 */
const MAP_STRIP_H = 110   // 컴팩트 지도 띠 높이(px)

export default function MainShell() {
  const mapExpanded     = useAppStore((s) => s.mapExpanded)
  const toggleMapExpanded = useAppStore((s) => s.toggleMapExpanded)

  return (
    <div
      className="h-dvh w-full flex flex-col md:hidden bg-bg dark:bg-bg overflow-hidden"
      style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
    >
      {/* 지도 영역: 컴팩트 띠 or 전체 확장 */}
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{
          height: mapExpanded ? 'calc(100% - 60px - env(safe-area-inset-bottom))' : `${MAP_STRIP_H}px`,
          transition: 'height 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <MapView />

        {/* 지도 확장/축소 버튼 — 우측 하단에 고정 */}
        <button
          onClick={toggleMapExpanded}
          aria-label={mapExpanded ? '지도 닫기' : '지도 보기'}
          className="
            absolute right-3 bottom-3 z-[60]
            flex items-center gap-1.5
            bg-white/95 dark:bg-[#272a33]/95
            border border-line dark:border-line
            rounded-card px-3 py-2
            text-[13px] font-bold text-accent dark:text-accent
            shadow-pill
            min-h-[40px]
            active:scale-95 transition-transform
          "
        >
          <Map size={16} aria-hidden="true" />
          {mapExpanded ? '닫기' : '지도'}
        </button>
      </div>

      {/* 대시보드 (정보 영역) — 지도 확장 시 숨김 */}
      {!mapExpanded && (
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <Dashboard />
        </div>
      )}
    </div>
  )
}
