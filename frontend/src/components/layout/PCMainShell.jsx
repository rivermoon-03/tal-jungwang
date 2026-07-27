import { useMemo, useState } from 'react'
import MapView from '../map/MapView'
import MapLegendOnboarding from '../map/MapLegendOnboarding'
import PCMapDockPanel from '../map/PCMapDockPanel'
import useAppStore from '../../stores/useAppStore'
import useMapBottomCardData from '../../hooks/useMapBottomCardData'

// 모드 필터 칩. 현재 실데이터(useMapBottomCardData)는 버스만 제공한다 — 셔틀/
// 지하철/택시를 하단 카드에 합류시키는 작업은 후속 범위(TODO 참고).
const MODE_FILTERS = [
  { id: 'bus',     label: '버스' },
  { id: 'shuttle', label: '셔틀' },
  { id: 'subway',  label: '지하철' },
  { id: 'taxi',    label: '택시' },
]

// PC 전용 메인 셸.
//
// 지도(children=null, 홈)에서는 좌측에 도킹 패널(PCMapDockPanel — 검색+필터,
// 정류장 선택, 도착 목록을 하나의 카드 컬럼으로 합친 것)을 두고, 그 오른쪽
// 나머지 전체를 MapView가 채운다(Google Maps식 레이아웃). 그 외 페이지
// (시간표·학식·더보기 등, children!=null)는 지도 위에 불투명 패널을 씌워
// 페이지 콘텐츠가 전체 폭을 차지하게 한다.
//
// 지도(MapView)는 어떤 탭에서도, 도킹 패널을 접거나 펼쳐도 절대 unmount 하지
// 않는다(GPS watch·타일 캐시가 죽지 않게) — MapView를 담는 flex-1 래퍼는 항상
// 같은 트리 위치에 마운트되어 있고, 도킹 패널/페이지 오버레이는 그 옆/위에서만
// 조건부로 나타났다 사라진다.
export default function PCMainShell({ children }) {
  const selectedId = useAppStore((s) => s.selectedMarkerId)
  const setSelectedIdStore = useAppStore((s) => s.setSelectedMarkerId)
  const handleMarkerClick = (id) => setSelectedIdStore(selectedId === id ? null : id)

  const showFloating = !children

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('bus')
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const bottomCardData = useMapBottomCardData()

  // 검색어 + 모드 필터를 클라이언트에서 적용한다. 백엔드 통합 검색은 범위 밖 —
  // TODO(검색): 노선/정류장 서버 검색 API가 생기면 이 클라 필터를 대체한다.
  const filteredRoutes = useMemo(() => {
    if (activeFilter !== 'bus') return [] // 셔틀/지하철/택시 데이터 소스는 아직 미연결
    const q = search.trim().toLowerCase()
    if (!q) return bottomCardData.routes
    return bottomCardData.routes.filter((r) =>
      `${r.name} ${r.badge} ${r.sub ?? ''}`.toLowerCase().includes(q)
    )
  }, [activeFilter, search, bottomCardData.routes])

  // 왜 카드를 통째로 비우는가: primary(대표 도착)는 버스 전용 데이터라서, 셔틀/
  // 지하철/택시 필터에서 그대로 두면 "셔틀을 눌렀는데 버스가 보이는" 상태가 된다.
  // 검색 중일 때도 마찬가지로 검색과 무관한 대표 카드가 남으면 결과로 오인된다.
  const isBusFilter = activeFilter === 'bus'
  const isSearching = search.trim().length > 0
  const showPrimary = isBusFilter && !isSearching

  // 빈 상태 문구는 원인별로 다르게 준다 — 필터 미지원 / 검색 결과 없음 /
  // 해당 방향 운행 없음은 사용자가 취할 행동이 서로 다르다.
  const emptyState = useMemo(() => {
    if (!isBusFilter) {
      const label = MODE_FILTERS.find((f) => f.id === activeFilter)?.label ?? ''
      return {
        title: `${label} 정보는 준비 중이에요`,
        description: '지금은 버스만 지도에서 실시간으로 볼 수 있어요. 셔틀과 지하철은 시간표 탭에서 확인해요.',
      }
    }
    if (isSearching && filteredRoutes.length === 0) {
      return {
        title: `"${search.trim()}" 검색 결과가 없어요`,
        description: '노선 번호나 정류장 이름의 일부만 입력해도 찾을 수 있어요.',
      }
    }
    if (!isSearching && filteredRoutes.length === 0 && !bottomCardData.primary) {
      return {
        title: '지금 이 방향은 도착 정보가 없어요',
        description: '운행이 끝났거나 아직 시작 전일 수 있어요. 방향을 바꾸거나 시간표를 확인해요.',
      }
    }
    return null
  }, [isBusFilter, activeFilter, isSearching, search, filteredRoutes.length, bottomCardData.primary])

  const filters = MODE_FILTERS.map((f) => ({ ...f, active: f.id === activeFilter }))

  const handleSelectRoute = (routeNo) => {
    const routeId = `bus:${routeNo}`
    const stopQuery = bottomCardData.stationLabel
      ? `?stop=${encodeURIComponent(bottomCardData.stationLabel)}`
      : ''
    const url = `/route/${routeId}${stopQuery}`
    window.history.pushState({ routeId }, '', url)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
  }

  return (
    <div className="relative hidden h-full w-full overflow-hidden md:flex">
      {showFloating && (
        <PCMapDockPanel
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
          search={search}
          onChangeSearch={setSearch}
          filters={filters}
          onToggleFilter={setActiveFilter}
          stationLabel={bottomCardData.stationLabel}
          live={showPrimary && bottomCardData.live}
          statusLabel={showPrimary ? bottomCardData.statusLabel : null}
          statusTone={bottomCardData.statusTone}
          primary={showPrimary ? (bottomCardData.primary ?? {}) : {}}
          routes={filteredRoutes}
          onSelectRoute={handleSelectRoute}
          emptyState={emptyState}
        />
      )}

      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        {/* selectedId는 MapView가 쓰지 않는다(마커 선택 상태는 store에서 직접 읽는다). */}
        <MapView
          onMarkerClick={handleMarkerClick}
          showControls={showFloating}
        />

        {showFloating && <MapLegendOnboarding />}

        {!showFloating && (
          <div className="absolute inset-0 z-30 overflow-y-auto bg-bg dark:bg-bg">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
