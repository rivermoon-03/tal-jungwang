import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import MapSearchOverlay from './MapSearchOverlay'
import MapBottomCard from './MapBottomCard'
import PCStationPicker from '../dashboard/PCStationPicker'
import StationPills from '../dashboard/StationPills'
import ShuttlePanel from '../summary/ShuttlePanel'
import SubwayPanel from '../summary/SubwayPanel'

/**
 * PCMapDockPanel — PC 지도 탭 좌측 도킹 패널.
 *
 * Google Maps식으로 지도 왼쪽에 고정 도킹되는 카드 컬럼. 검색+필터 →
 * 정류장 선택 → 선택 정류장 도착 목록을 세로로 쌓아 스크롤한다. 지도 위를
 * 떠다니던 3개의 플로팅 블록(검색 pill / 정류장 카드 / 하단 도착 카드)을
 * 하나의 패널로 합쳐 지도 라벨을 가리지 않게 한다.
 *
 * 대부분 순수 프레젠테이셔널 컴포넌트다 — 버스 데이터는 부모(PCMainShell)가
 * useMapBottomCardData 등으로 계산해 props로 내려준다. 접기 상태만 이 컴포넌트가
 * 아니라 부모가 들고 있어(collapsed/onToggleCollapsed) 지도 레이아웃(flex 폭)과
 * 함께 제어한다.
 *
 * 셔틀·지하철 필터만 예외다 — 대표 도착 카드(MapBottomCard.primary)가 버스
 * 전용 실시간 데이터라 그 자리에 셔틀/지하철을 억지로 끼워 넣는 대신, 모바일
 * Dashboard가 이미 쓰는 ShuttlePanel/SubwayPanel(요약/summary)을 그대로
 * 재사용한다. 두 컴포넌트는 스스로 store를 구독하고 데이터를 패칭하는
 * 자기완결형이라(부모가 props로 데이터를 내려줄 필요 없음) props 계약을
 * 늘리지 않고도 끼워 넣을 수 있었다 — "같은 정보를 두 벌로 구현하지 않는다"는
 * 원칙을 지킨다. 정류장/캠퍼스 선택도 마찬가지로 모바일 StationPills를 그대로 쓴다.
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
  emptyState = null,
}) {
  // filters(MODE_FILTERS)에 이미 active 필터가 인코딩돼 있어 별도 prop을
  // 만들지 않는다 — PCMainShell이 만드는 filters 배열을 그대로 신뢰한다.
  const activeFilterId = filters.find((f) => f.active)?.id ?? 'bus'

  if (collapsed) {
    return (
      <div className="relative z-nav flex h-full w-11 flex-none flex-col items-center gap-2 border-r border-line bg-surface-2/90 pt-3 backdrop-blur-md dark:bg-surface/90">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="지도 패널 펼치기"
          title="지도 패널 펼치기"
          className="pressable grid h-9 w-9 place-items-center rounded-btn bg-surface text-ink-2 shadow-pill"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        {/* 접힌 상태에서도 검색으로 바로 들어갈 수 있어야 한다. 이전에는 패널을
            접으면 검색창까지 사라져 지도를 넓게 보려면 검색을 포기해야 했다. */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="노선·정류장 검색"
          title="노선·정류장 검색"
          className="pressable grid h-9 w-9 place-items-center rounded-btn text-ink-2 hover:bg-ink/[0.06]"
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="pc-map-dock-panel"
      className="relative z-nav flex h-full w-[340px] flex-none flex-col border-r border-line bg-surface-2/90 backdrop-blur-md dark:bg-surface/90 xl:w-[380px]"
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

        {activeFilterId === 'shuttle' && (
          <>
            <div className="overflow-hidden rounded-card border border-line bg-surface px-1 py-3 shadow-sh-pop">
              <StationPills mode="shuttle" />
            </div>
            <div className="rounded-card border border-line bg-surface p-3 shadow-sh-pop">
              <ShuttlePanel />
            </div>
          </>
        )}

        {activeFilterId === 'subway' && (
          <>
            <div className="overflow-hidden rounded-card border border-line bg-surface px-1 py-3 shadow-sh-pop">
              <StationPills mode="subway" />
            </div>
            <div className="rounded-card border border-line bg-surface p-3 shadow-sh-pop">
              <SubwayPanel dataMode="timetable" />
            </div>
          </>
        )}

        {/* 버스(기본) · 택시(아직 미연결, TODO) — 정류장 선택 + 대표 도착 카드. */}
        {activeFilterId !== 'shuttle' && activeFilterId !== 'subway' && (
          <>
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sh-pop">
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
              emptyState={emptyState}
              showGrip={false}
            />
          </>
        )}
      </div>
    </div>
  )
}
