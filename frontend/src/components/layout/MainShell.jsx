import { useSnap } from '../../hooks/useSnap'
import SnapHandle from './SnapHandle'
import MapView from '../map/MapView'
import Dashboard from '../dashboard/Dashboard'

/**
 * MainShell — 모바일 전용 2단 스냅 레이아웃 셸.
 *
 * 구조 (세로):
 *   MapView    (snapMode에 따라 %)
 *   SnapHandle (핸들)
 *   Dashboard  (snapMode에 따라 %)
 *
 * 높이 비율은 useSnap의 heights에서 계산된다.
 * CSS transition으로 height 변화에 240ms ios-ease 적용.
 * (prefers-reduced-motion 시엔 --dur-snap이 0ms 이므로 즉시 전환)
 *
 * md:hidden — 모바일 전용. PC는 Phase F에서 기존 레이아웃으로 분기.
 */
// SnapHandle의 고정 높이 (Tailwind h-6 = 24px). 이 값을 전체 높이에서 제외해서
// 지도·대시보드가 나누어 갖도록 해야 핸들이 항상 화면 안에 남는다.
const HANDLE_PX = 24

export default function MainShell() {
  const { heights, handlers } = useSnap()

  const snapTransition = {
    transition: 'height var(--dur-snap, 240ms) var(--ease-ios, cubic-bezier(0.16, 1, 0.3, 1))',
  }

  const mapHeight  = `calc((100% - ${HANDLE_PX}px) * ${heights.map / 100})`
  const dashHeight = `calc((100% - ${HANDLE_PX}px) * ${heights.dashboard / 100})`

  return (
    <div
      className="h-dvh w-full flex flex-col md:hidden bg-white dark:bg-bg-dark overflow-hidden"
      style={{
        touchAction: 'pan-y',
        // 하단 BottomDock(60px)과 iOS safe area가 MainShell 영역을 덮지 않도록
        // 해당만큼 내부 컨텐츠 영역을 축소한다. 핸들·대시보드가 항상 보이게.
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
      }}
    >
      {/* 지도 영역 */}
      <div
        className="relative w-full overflow-hidden shrink-0"
        style={{ height: mapHeight, ...snapTransition }}
      >
        <MapView />
      </div>

      <SnapHandle {...handlers} />

      {/* 대시보드 영역 */}
      <div
        className="relative w-full overflow-hidden shrink-0"
        style={{ height: dashHeight, ...snapTransition }}
      >
        <Dashboard />
      </div>
    </div>
  )
}
