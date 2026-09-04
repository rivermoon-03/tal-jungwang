import { Suspense, useMemo, useState } from 'react'
import { LazyMapView } from '../map/MapView.lazy'
import MapViewFallback from '../map/MapViewFallback'
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

// PCSidebar.jsx의 aside 폭(className="... w-[236px] ...")과 반드시 같은 값을
// 유지해야 한다. GlobalSubwayDetailSheet/GlobalSubwayLineSheet처럼 뷰포트
// 기준 fixed로 좌측에 뜨는 PC 도킹 패널이 이 값을 가져다 써서 사이드바 뒤가
// 아니라 사이드바 오른쪽(지도 패널이 놓인 칼럼)에서 시작하게 한다. PCSidebar는
// Tailwind JIT가 정적 문자열로 스캔해야 해서 이 상수를 클래스에 그대로 꽂아
// 넣을 수 없어(w-[${PC_SIDEBAR_WIDTH_PX}px]는 인식되지 않는다) 값 자체는
// 두 파일에 각각 남지만, 소비자 쪽은 전부 이 상수 하나만 참조한다.
export const PC_SIDEBAR_WIDTH_PX = 236

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
//
// MapView는 별도 청크(MapView.lazy)로 내려받는다 — 모바일 MainShell은 지도를
// 실제로 펼치는 시점에 이 청크를 불러오지만, PC는 지도가 첫 화면부터 항상
// 보이는 레이아웃이라 지연시킬 시점 자체가 없다. 그래서 여기서는 마운트되는
// 즉시(대기 없이) 로드한다 — Suspense fallback(MapViewFallback)이 뜨는 시간은
// 청크 파싱·실행이 index 번들에서 빠져나가 index 자체가 가벼워진 만큼이라,
// 기존에 index 안에 있던 MapView를 파싱하던 시간과 크게 다르지 않다.
// PCMainShell.test.jsx가 findBy로 이 지연을 검증한다.
export default function PCMainShell({ children }) {
  const selectedId = useAppStore((s) => s.selectedMarkerId)
  const setSelectedIdStore = useAppStore((s) => s.setSelectedMarkerId)
  const handleMarkerClick = (id) => setSelectedIdStore(selectedId === id ? null : id)

  const showFloating = !children

  // 지도 탭의 두 관점. 모바일 Dashboard 가 homeView 로 "지금 ↔ 시간표"를 제자리에서
  // 바꾸는 것과 같은 방식이다. 여기서도 MapView 는 손대지 않고 도킹 패널 내용만 바꾼다.
  const homeView = useAppStore((s) => s.homeView)
  const setHomeView = useAppStore((s) => s.setHomeView)

  // 모드 필터의 단일 출처는 useAppStore.selectedMode 다. 예전엔 이 셸이 자체
  // useState(activeFilter)를 들고 있어서, 지도 필터를 셔틀로 바꿔도 시간표
  // (SchedulePage embedded, storedMode 구독)나 지도 마커 필터(MapView, 같은
  // selectedMode 구독)는 그대로였다 — 세 곳이 각자 다른 상태를 보고 있었다.
  // selectedMode는 이미 모바일 ModeTabs·Dashboard·MapView·/schedule?type= 딥링크
  // (App.jsx adoptLegacySchedulePath)가 공유하는 값이라, PC 필터도 여기에 맞춘다.
  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)

  // 택시는 시간표 개념이 없다(Dashboard.jsx canShowTimetable와 같은 규칙). 필터가
  // 택시인 채로 사이드바에서 "시간표"를 눌러도 homeView는 'timetable'로 바뀌지만,
  // 여기서 그 값을 무시하고 도킹 패널(지금 보기)을 계속 보여준다 — 모바일이
  // Dashboard의 `view = canShowTimetable ? homeView : 'now'`로 처리하는 것과 동일한
  // 규칙을 PC 쪽 렌더 분기에도 적용한 것이다.
  const showTimetable = showFloating && homeView === 'timetable' && selectedMode !== 'taxi'

  const [search, setSearch] = useState('')
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const bottomCardData = useMapBottomCardData()

  // 검색어 + 모드 필터를 클라이언트에서 적용한다. 백엔드 통합 검색은 범위 밖 —
  // TODO(검색): 노선/정류장 서버 검색 API가 생기면 이 클라 필터를 대체한다.
  const filteredRoutes = useMemo(() => {
    // 이 목록은 MapBottomCard의 버스 전용 미니 카드 그리드에만 쓰인다 — 셔틀/
    // 지하철은 PCMapDockPanel이 ShuttlePanel/SubwayPanel로 따로 그리므로 필요 없다.
    if (selectedMode !== 'bus') return []
    const q = search.trim().toLowerCase()
    if (!q) return bottomCardData.routes
    return bottomCardData.routes.filter((r) =>
      `${r.name} ${r.badge} ${r.sub ?? ''}`.toLowerCase().includes(q)
    )
  }, [selectedMode, search, bottomCardData.routes])

  // 왜 카드를 통째로 비우는가: primary(대표 도착)는 버스 전용 데이터라서, 셔틀/
  // 지하철/택시 필터에서 그대로 두면 "셔틀을 눌렀는데 버스가 보이는" 상태가 된다.
  // 검색 중일 때도 마찬가지로 검색과 무관한 대표 카드가 남으면 결과로 오인된다.
  const isBusFilter = selectedMode === 'bus'
  const isSearching = search.trim().length > 0
  const showPrimary = isBusFilter && !isSearching

  // 빈 상태 문구는 원인별로 다르게 준다 — 필터 미지원 / 검색 결과 없음 /
  // 해당 방향 운행 없음은 사용자가 취할 행동이 서로 다르다.
  //
  // 셔틀/지하철은 여기 안 걸린다 — PCMapDockPanel이 그 두 필터에서는 이
  // emptyState를 아예 쓰지 않고 ShuttlePanel/SubwayPanel을 직접 그린다(각자
  // 자기 빈 상태를 갖고 있다). 택시만 실데이터가 아직 없어 "준비 중"으로 남는다.
  const emptyState = useMemo(() => {
    if (selectedMode === 'taxi') {
      // 택시는 시간표 개념 자체가 없다(모바일 Dashboard.jsx canShowTimetable와
      // 동일한 전제). 예전 문구는 "택시는 시간표 탭에서 확인해요"였는데, 실제로는
      // 시간표 탭이 택시를 다루지 않고(SchedulePage isValidMode에 taxi가 없음)
      // 필터가 택시인 동안은 사이드바에서 "시간표"를 눌러도 이 도킹 패널이 그대로
      // 남는다(showTimetable 가드) — 존재하지 않는 곳으로 안내하지 않는다.
      return {
        title: '택시 정보는 준비 중이에요',
        description: '지금은 버스만 지도에서 실시간으로 볼 수 있어요.',
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
  }, [isBusFilter, selectedMode, isSearching, search, filteredRoutes.length, bottomCardData.primary])

  const filters = MODE_FILTERS.map((f) => ({ ...f, active: f.id === selectedMode }))

  const handleSelectRoute = (routeNo) => {
    const routeId = `bus:${routeNo}`
    const stopQuery = bottomCardData.stationLabel
      ? `?stop=${encodeURIComponent(bottomCardData.stationLabel)}`
      : ''
    const url = `/route/${routeId}${stopQuery}`
    window.history.pushState({ routeId }, '', url)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
  }

  // 지금/시간표 전환 컨트롤 — 예전엔 PCSidebar가 "홈" 아래 "지금"/"시간표" 두
  // 하위 항목으로 이 전환을 맡았는데, 그러면 홈 자신과 그 아래 "지금"이 동시에
  // 강조돼 두 줄이 같이 칠해졌다(계층이 홈의 하위인지 별개 탭인지 읽히지
  // 않았다 — 사용자 지적: "PC버전 지금-시간표 사용이 좀 이상함"). PCMainShell은
  // 이미 시간표 뷰에서만 이 세그먼트를 그리고 있었으니, 지금(도킹 패널) 뷰에도
  // 같은 세그먼트를 얹어 사이드바 대신 여기 한 곳에서 전환하게 한다. 택시는
  // 시간표 개념이 없어(Dashboard.jsx canShowTimetable와 동일 규칙) 숨긴다.
  // 도킹 패널이 접힌 상태(44px)에서는 세그먼트를 놓을 자리가 없어 같이 숨긴다
  // — PCMapDockPanel 자신도 접히면 제목/필터 없이 아이콘 두 개만 남는다.
  const showModeSwitch = showFloating && selectedMode !== 'taxi' && (showTimetable || !panelCollapsed)

  // 지금(도킹 패널)과 시간표는 폭이 다르다(도킹 340/380, 시간표 380/440 — 시간표는
  // 하루 전체 일정을 보여줘야 해서 더 넓다). 컬럼을 하나로 합쳐도 이 폭 차이는
  // 그대로 유지한다. 접힌 도킹 패널일 때만 컬럼 폭도 44px로 좁힌다 — 안 그러면
  // 접힌 44px 패널 옆에 빈 여백이 300px 가까이 남는다.
  const columnWidthClass = showTimetable
    ? 'w-[380px] xl:w-[440px]'
    : panelCollapsed
      ? 'w-11'
      : 'w-[340px] xl:w-[380px]'

  return (
    <div className="relative hidden h-full w-full overflow-hidden md:flex">
      {showFloating && (
        <aside
          className={`relative z-20 flex h-full ${columnWidthClass} flex-none flex-col overflow-hidden ${
            showTimetable ? 'border-r border-line bg-surface dark:bg-surface' : ''
          }`}
        >
          {showModeSwitch && (
            /* px-4 — 아래 SchedulePage embedded 본문(ScheduleSectionView)의 모드/통계
               버튼 행도 px-4를 쓴다. 시간표 상태에서만 px-3이면 세그먼트와 그 아래
               행이 4px 어긋나 보였다(서로 다른 정렬 기준). 지금(도킹) 상태에서는
               이 헤더가 PCMapDockPanel의 border-r/bg를 대신 이어받아 컬럼 전체가
               끊김 없는 한 장의 패널로 보이게 한다. */
            <div
              className={`flex-none px-4 pb-2 pt-3 ${
                showTimetable ? '' : 'border-r border-line bg-surface-2/90 backdrop-blur-md dark:bg-surface/90'
              }`}
            >
              <SegmentedControl
                options={MAP_VIEWS}
                value={homeView}
                onChange={setHomeView}
                ariaLabel="지도 보기 전환"
              />
            </div>
          )}
          <div className="min-h-0 flex-1">
            {showTimetable ? (
              <SchedulePage embedded />
            ) : (
              <PCMapDockPanel
                collapsed={panelCollapsed}
                onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
                search={search}
                onChangeSearch={setSearch}
                filters={filters}
                onToggleFilter={setSelectedMode}
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
          </div>
        </aside>
      )}

      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        {/* selectedId는 MapView가 쓰지 않는다(마커 선택 상태는 store에서 직접 읽는다). */}
        <Suspense fallback={<MapViewFallback />}>
          <LazyMapView
            onMarkerClick={handleMarkerClick}
            showControls={showFloating}
          />
        </Suspense>

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
