import useAppStore from '../../stores/useAppStore'
import MapView from '../map/MapView'
import Dashboard from '../dashboard/Dashboard'
import HomeWeatherHero from '../dashboard/HomeWeatherHero'
import { DOCK_RESERVED_PX } from '../common/FloatingDock'

/**
 * MainShell — 모바일 전용 레이아웃 셸.
 *
 * 구조(세로) — 홈 화면 재설계(시안): 히어로 고정 + 대시보드 내부 스크롤 대신
 * "한 컬럼 통짜 스크롤"이다. HomeWeatherHero와 Dashboard를 같은 overflow-y-auto
 * 컨테이너 안에 나란히 놓는다 — 히어로는 페이지 맨 위에서 시작해 스크롤하면
 * 카드 목록과 함께 위로 밀려 올라가 사라진다. 히어로가 화면을 영구 점유하며
 * 대시보드를 내부 스크롤에 가두던 결함(#31)은 히어로를 "접은 한 줄 스트립"으로
 * 줄여서 해결했었지만, 새 시안은 히어로를 원래 크기(~340px)로 되돌리는 대신
 * 그 히어로 자체가 스크롤에 실려 사라지게 해서 같은 문제를 다른 방식으로
 * 막는다 — 스크롤하면 카드 목록이 화면 전체를 곧 차지하므로 결함 #31이
 * 재발하지 않는다.
 *
 * 지도 전환: 히어로 스트립의 [지도] 버튼 → mapExpanded=true → 지도가 전체 화면.
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
 * 시간표(homeView==='timetable') 예외: SchedulePage는 상단 그룹 칩을 고정하고
 * 목록만 내부 스크롤하는 자체 레이아웃이라, 페이지 전체가 함께 스크롤되면
 * 그 고정 효과가 사라진다. 이 경우엔 기존처럼 히어로를 숨기고 Dashboard에
 * 남은 높이를 전부 내어줘(overflow-hidden) 시간표가 스스로 스크롤을 관리하게
 * 한다 — "통짜 스크롤" 원칙은 기본 홈 화면("지금" 뷰)에만 적용한다.
 *
 * 하단 예약 여백(DOCK_RESERVED_PX, 결함 #7): FloatingDock이 화면 하단에서
 * 실제로 가리는 높이를 FloatingDock.jsx가 상수로 소유한다(자기 자신의 치수라
 * 그 컴포넌트가 단일 출처를 갖는 게 맞다) — 여기서는 그 값을 그대로 가져다
 * 콘텐츠 하단 패딩에 쓴다. 각 페이지가 저마다 pb-28 같은 값을 임의로 붙이는
 * 대신 이 셸 한 곳에서만 계산해 하단 패딩을 보장한다(safe-area는 별도로
 * env()로 더한다).
 */

export default function MainShell() {
  const mapExpanded       = useAppStore((s) => s.mapExpanded)
  const toggleMapExpanded = useAppStore((s) => s.toggleMapExpanded)
  const homeView          = useAppStore((s) => s.homeView)
  const selectedMode      = useAppStore((s) => s.selectedMode)
  // Dashboard.jsx의 canShowTimetable과 같은 조건(택시는 시간표 개념이 없어 항상 '지금').
  const isTimetable = homeView === 'timetable' && selectedMode !== 'taxi'

  return (
    <div
      className="h-dvh w-full flex flex-col md:hidden bg-bg dark:bg-bg overflow-hidden"
      // mapExpanded일 땐 지도 자체 높이 계산이 이미 DOCK_RESERVED_PX+safe-area를 뺀다 —
      // 여기서도 같은 여백을 padding으로 또 빼면 지도 하단이 이중으로 잘려 보인다(#지도잘림).
      style={{ paddingBottom: mapExpanded ? undefined : `calc(${DOCK_RESERVED_PX}px + env(safe-area-inset-bottom))` }}
    >
      {/* 지도 전체화면 — 평소엔 height 0으로 마운트만 유지, 확장 시 전체 */}
      <div
        className="relative w-full shrink-0 overflow-hidden"
        style={{
          height: mapExpanded ? `calc(100% - ${DOCK_RESERVED_PX}px - env(safe-area-inset-bottom))` : '0px',
          transition: 'height 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <MapView mapExpanded={mapExpanded} onClose={toggleMapExpanded} />
      </div>

      {/* 히어로 + 대시보드 — 지도 확장 시 숨김(언마운트: 기존에도 동일 동작).
          '지금' 뷰: 한 컨테이너를 함께 스크롤(히어로가 스크롤에 실려 사라진다).
          '시간표' 뷰: 히어로를 숨기고 Dashboard가 남은 높이를 전부 내부 스크롤로 쓴다. */}
      {!mapExpanded && (
        isTimetable ? (
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <Dashboard />
          </div>
        ) : (
          <div className="relative flex-1 min-h-0 overflow-y-auto">
            <HomeWeatherHero onOpenMap={toggleMapExpanded} />
            <Dashboard />
          </div>
        )
      )}
    </div>
  )
}
