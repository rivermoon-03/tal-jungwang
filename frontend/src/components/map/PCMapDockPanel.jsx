import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import MapSearchOverlay from './MapSearchOverlay'
import MapBottomCard from './MapBottomCard'
import PCStationPicker from '../dashboard/PCStationPicker'

/**
 * PCMapDockPanel — PC 지도 탭 좌측 도킹 패널.
 *
 * Google Maps식으로 지도 왼쪽에 고정 도킹되는 카드 컬럼. 검색+필터 →
 * 정류장 선택 → 선택 정류장 도착 목록을 세로로 쌓아 스크롤한다. 지도 위를
 * 떠다니던 3개의 플로팅 블록(검색 pill / 정류장 카드 / 하단 도착 카드)을
 * 하나의 패널로 합쳐 지도 라벨을 가리지 않게 한다.
 *
 * 순수 프레젠테이셔널 컴포넌트에 가깝다 — 데이터는 부모(PCMainShell)가
 * useMapBottomCardData 등으로 계산해 props로 내려준다. 접기 상태만 이 컴포넌트가
 * 아니라 부모가 들고 있어(collapsed/onToggleCollapsed) 지도 레이아웃(flex 폭)과
 * 함께 제어한다.
 */
export default function PCMapDockPanel({
  collapsed = false,
  onToggleCollapsed,
  search,
  onChangeSearch,
  filters = [],
  onToggleFilter,
  stationLabel,
  live = false,
  statusLabel,
  statusTone = 'ease',
  primary = {},
  routes = [],
  onSelectRoute,
}) {
  if (collapsed) {
    return (
      <div className="relative z-20 flex h-full w-11 flex-none flex-col items-center border-r border-line bg-surface-2/90 pt-3 backdrop-blur-md dark:bg-surface/90">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="지도 패널 펼치기"
          title="지도 패널 펼치기"
          className="pressable grid h-9 w-9 place-items-center rounded-btn bg-surface text-ink-2 shadow-pill"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <MapPin size={16} className="mt-3 text-mute" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      data-testid="pc-map-dock-panel"
      className="relative z-20 flex h-full w-[340px] flex-none flex-col border-r border-line bg-surface-2/90 backdrop-blur-md dark:bg-surface/90"
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
        <h2 className="text-caption font-extrabold tracking-[-0.02em] text-ink">지도</h2>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="지도 패널 접기"
          title="지도 패널 접기"
          className="pressable grid h-8 w-8 place-items-center rounded-btn text-ink-2 hover:bg-ink/[0.06]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        <MapSearchOverlay
          value={search}
          onChange={onChangeSearch}
          filters={filters}
          onToggleFilter={onToggleFilter}
          className="w-full"
        />

        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <PCStationPicker />
        </div>

        <MapBottomCard
          stationName={stationLabel}
          live={live}
          statusLabel={statusLabel}
          statusTone={statusTone}
          primary={primary}
          routes={routes}
          onSelectRoute={onSelectRoute}
          showGrip={false}
          className="shadow-card"
        />
      </div>
    </div>
  )
}
