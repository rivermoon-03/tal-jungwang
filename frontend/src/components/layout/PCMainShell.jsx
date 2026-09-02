import { useMemo, useState } from 'react'
import MapView from '../map/MapView'
import MapLegendOnboarding from '../map/MapLegendOnboarding'
import PCMapDockPanel from '../map/PCMapDockPanel'
import SegmentedControl from '../ui/SegmentedControl'
import SchedulePage from '../schedule/SchedulePage'
import useAppStore from '../../stores/useAppStore'
import useMapBottomCardData from '../../hooks/useMapBottomCardData'

// pages/SchedulePage 는 props 를 전달하지 않는 /schedule 전용 래퍼라, 모바일
// Dashboard 와 같이 컴포넌트를 직접 쓴다 — 그래야 embedded 가 실제로 전달된다.
// lazy 로 두면 Dashboard 가 같은 모듈을 정적 import 하고 있어 청크가 갈리지 않는다
// (rollup INEFFECTIVE_DYNAMIC_IMPORT). 어차피 같은 청크라면 정적 import 가 낫다.

const MAP_VIEWS = [
  { value: 'now', label: '지금' },
  { value: 'timetable', label: '시간표' },
]

// 모드 필터 칩. 버스는 useMapBottomCardData(실시간 지도 데이터)를 쓴다. 셔틀/
// 지하철은 대표 도착 카드에 합류시키는 대신 PCMapDockPanel이 모바일 요약 패널
// (ShuttlePanel/SubwayPanel)을 그대로 재사용해 보여준다 — 택시만 아직 미연결
// (TaxiPanel도 있지만 이번 범위에는 없다, 후속 TODO).
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

  // 지도 탭의 두 관점. 모바일 Dashboard 가 homeView 로 "지금 ↔ 시간표"를 제자리에서
  // 바꾸는 것과 같은 방식이다. 여기서도 MapView 는 손대지 않고 도킹 패널 내용만 바꾼다.
  const homeView = useAppStore((s) => s.homeView)
  const setHomeView = useAppStore((s) => s.setHomeView)
  const showTimetable = showFloating && homeView === 'timetable'

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('bus')
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const bottomCardData = useMapBottomCardData()

  // 검색어 + 모드 필터를 클라이언트에서 적용한다. 백엔드 통합 검색은 범위 밖 —
  // TODO(검색): 노선/정류장 서버 검색 API가 생기면 이 클라 필터를 대체한다.
  const filteredRoutes = useMemo(() => {
    // 이 목록은 MapBottomCard의 버스 전용 미니 카드 그리드에만 쓰인다 — 셔틀/
    // 지하철은 PCMapDockPanel이 ShuttlePanel/SubwayPanel로 따로 그리므로 필요 없다.
    if (activeFilter !== 'bus') return []
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
  //
  // 셔틀/지하철은 여기 안 걸린다 — PCMapDockPanel이 그 두 필터에서는 이
  // emptyState를 아예 쓰지 않고 ShuttlePanel/SubwayPanel을 직접 그린다(각자
  // 자기 빈 상태를 갖고 있다). 택시만 실데이터가 아직 없어 "준비 중"으로 남는다.
  const emptyState = useMemo(() => {
    if (activeFilter === 'taxi') {
      return {
        title: '택시 정보는 준비 중이에요',
        description: '지금은 버스만 지도에서 실시간으로 볼 수 있어요. 택시는 시간표 탭에서 확인해요.',
      }
    }
    if (!isBusFilter) return null
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
      {showTimetable && (
        <aside className="relative z-20 flex h-full w-[380px] flex-none flex-col overflow-hidden border-r border-line bg-surface dark:bg-surface xl:w-[440px]">
          {/* px-4 — 아래 SchedulePage embedded 본문(ScheduleSectionView)의 모드/통계
              버튼 행도 px-4를 쓴다. 여기만 px-3이면 세그먼트와 그 아래 행이 4px
              어긋나 보였다(서로 다른 정렬 기준). */}
          <div className="flex-none px-4 pb-2 pt-3">
            <SegmentedControl
              options={MAP_VIEWS}
              value={homeView}
              onChange={setHomeView}
              ariaLabel="지도 보기 전환"
            />
          </div>
          <div className="min-h-0 flex-1">
            <SchedulePage embedded />
          </div>
        </aside>
      )}

      {showFloating && !showTimetable && (
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

        {showFloating && !showTimetable && <MapLegendOnboarding />}

        {!showFloating && (
          <div className="absolute inset-0 z-30 overflow-y-auto bg-bg dark:bg-bg">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
