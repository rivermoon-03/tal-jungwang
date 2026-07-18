import { Map } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import MapView from '../map/MapView'
import Dashboard from '../dashboard/Dashboard'
import HomeWeatherHero from '../dashboard/HomeWeatherHero'

/**
 * MainShell — 모바일 전용 레이아웃 셸 (시안3: 상단 A / 하단 B).
 *
 * 구조 (세로):
 *   상단 A — HomeWeatherHero (날씨 반응형 히어로 + 등하교 pill + 지도 전환 버튼)
 *   하단 B — Dashboard (모드탭·정류장칩·도착카드)
 *
 * 지도 전환: 상단 A의 [지도] 버튼 → mapExpanded=true → 지도가 전체 화면.
 * MapView는 접힌 상태에서도 height:0 컨테이너에 마운트 유지(재초기화 비용
 * 회피) — 기존에도 같은 이유로 always-mount였고, MapView 내부
 * ResizeObserver가 컨테이너 리사이즈마다 relayout()을 호출하므로
 * 0↔전체 전환도 기존 110px↔전체 전환과 같은 경로로 안전하게 처리된다.
 *
 * md:hidden — 모바일 전용. PC는 PCMainShell에서 별도 처리.
 */
export default function MainShell() {
  const mapExpanded     = useAppStore((s) => s.mapExpanded)
  const toggleMapExpanded = useAppStore((s) => s.toggleMapExpanded)

  return (
    <div
      className="h-dvh w-full flex flex-col md:hidden bg-bg dark:bg-bg overflow-hidden"
      // mapExpanded일 땐 지도 자체 높이 계산이 이미 60px+safe-area를 뺀다 —
      // 여기서도 같은 여백을 padding으로 또 빼면 지도 하단이 이중으로 잘려 보인다(#지도잘림).
      style={{ paddingBottom: mapExpanded ? undefined : 'calc(60px + env(safe-area-inset-bottom))' }}
    >
      {/* 지도 전체화면 — 평소엔 height 0으로 마운트만 유지, 확장 시 전체 */}
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{
          height: mapExpanded ? 'calc(100% - 60px - env(safe-area-inset-bottom))' : '0px',
          transition: 'height 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <MapView />

        {/* 지도 닫기 버튼 — 확장 상태에서만 노출(축소 상태의 진입점은 HomeWeatherHero의 [지도] 버튼) */}
        {mapExpanded && (
          <button
            onClick={toggleMapExpanded}
            aria-label="지도 닫기"
            className="
              absolute right-4 bottom-5 z-[60]
              flex items-center gap-1.5
              bg-white/95 dark:bg-[#272a33]/95
              border border-line dark:border-line
              rounded-card px-3 py-2
              text-[13px] font-bold text-accent dark:text-accent
              shadow-pill
              min-h-[40px]
              active:scale-[0.94] transition-transform duration-press ease-spring
            "
          >
            <Map size={16} aria-hidden="true" />
            닫기
          </button>
        )}
      </div>

      {/* 상단 A + 하단 B — 지도 확장 시 숨김(언마운트: 기존에도 동일 동작) */}
      {!mapExpanded && (
        <>
          <HomeWeatherHero onOpenMap={toggleMapExpanded} />
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <Dashboard />
          </div>
        </>
      )}
    </div>
  )
}
