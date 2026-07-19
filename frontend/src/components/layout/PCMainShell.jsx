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
          live={bottomCardData.live}
          statusLabel={bottomCardData.statusLabel}
          statusTone={bottomCardData.statusTone}
          primary={bottomCardData.primary ?? {}}
          routes={filteredRoutes}
          onSelectRoute={handleSelectRoute}
        />
      )}

      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        <MapView onMarkerClick={handleMarkerClick} selectedId={selectedId} />

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
