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
 * 지도 닫기 버튼(M-1 이후)은 MapView 내부의 우측 상단 컨트롤 스택으로
 * 옮겨졌다 — MainShell은 mapExpanded/onClose만 넘기고, 검색 pill·GPS/학교
 * FAB·닫기 버튼을 하나의 세로 스택으로 배치하는 책임은 MapView가 진다
 * (닫기 버튼 자체는 height:0 컨테이너의 overflow-hidden에 의해 축소 상태에서
 * 자연히 가려지므로 여기서 mapExpanded로 다시 감쌀 필요가 없다).
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
        <MapView mapExpanded={mapExpanded} onClose={toggleMapExpanded} />
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
