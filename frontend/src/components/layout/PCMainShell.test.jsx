/**
 * PCMainShell — 지도 탭 안에서 "지금 ↔ 시간표"가 제자리 전환되는지, 그리고
 * 지도 모드 필터와 시간표 모드가 useAppStore.selectedMode 하나를 공유하는지
 * 고정한다.
 *
 * 예전에는 사이드바의 "시간표"가 /schedule 로 pushState 했고, 그러면
 * showFloating(=!children) 이 false 가 되면서 도킹 패널이 통째로 unmount 되고
 * 지도 위에 불투명 페이지가 덮였다. PCMapDockPanel 에는 homeView prop 도,
 * 스케줄 컴포넌트 import 도 없어서 지도 탭에 머문 채 시간표가 그려질 코드 경로
 * 자체가 없었다. 모바일 Dashboard 는 같은 일을 SchedulePage embedded 로
 * 제자리 렌더해 이미 올바르게 하고 있었다.
 *
 * 그 뒤로도 이 셸은 지도 모드 필터를 자체 useState(activeFilter)로 들고
 * 있었다 — SchedulePage(embedded)는 이미 useAppStore.selectedMode를 읽고
 * 쓰는데, 지도 필터 칩은 그 값을 전혀 건드리지 않아 "지도는 셔틀인데
 * 시간표는 버스"처럼 어긋날 수 있었다. 아래 그룹은 필터 칩과 selectedMode가
 * 하나로 묶여 있는지, 택시 필터에서는 시간표로 넘어가지 않는지를 고정한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PCMainShell from './PCMainShell'

let storeState = {}

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) => selector(storeState)),
}))

// PCMainShell은 MapView를 MapView.lazy(React.lazy) 경유로만 부른다 — 정적
// import가 남아 있으면 청크가 index로 합쳐지므로, 아래 지도 관련 단언은 전부
// findBy로 Suspense 해제를 기다린다.
vi.mock('../map/MapView', () => ({
  default: () => <div data-testid="map-view">MapView</div>,
}))
vi.mock('../map/MapLegendOnboarding', () => ({
  default: () => <div data-testid="map-legend">Legend</div>,
}))
// filters/onToggleFilter를 그대로 노출해, 이 셸이 실제로 selectedMode 기반
// active 필터를 넘기고 클릭을 setSelectedMode로 되돌리는지 검증한다.
// collapsed/onToggleCollapsed도 노출해, 패널이 접힌 상태에서 상단 지금/시간표
// 세그먼트가 함께 숨는지(자리 없음) 확인할 수 있게 한다.
vi.mock('../map/PCMapDockPanel', () => ({
  default: ({ filters, onToggleFilter, collapsed, onToggleCollapsed }) => (
    <div data-testid="dock-panel">
      DockPanel
      <span data-testid="active-filter">{filters.find((f) => f.active)?.id ?? 'none'}</span>
      <span data-testid="panel-collapsed">{String(collapsed)}</span>
      <button type="button" onClick={onToggleCollapsed}>패널 접기</button>
      {filters.map((f) => (
        <button key={f.id} type="button" onClick={() => onToggleFilter(f.id)}>
          {f.label}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('../schedule/SchedulePage', () => ({
  default: ({ embedded }) => (
    <div data-testid="schedule-embedded">SchedulePage embedded={String(embedded)}</div>
  ),
}))
vi.mock('../../hooks/useMapBottomCardData', () => ({
  default: () => ({
    routes: [],
    stationLabel: '한국공학대 정문',
    live: false,
    statusLabel: null,
    statusTone: null,
    primary: {},
  }),
}))

describe('PCMainShell', () => {
  beforeEach(() => {
    storeState = {
      selectedMarkerId: null,
      setSelectedMarkerId: vi.fn(),
      homeView: 'now',
      setHomeView: vi.fn(),
      selectedMode: 'bus',
      setSelectedMode: vi.fn(),
    }
  })

  it('지도 홈 · 지금: 도킹 패널과 지도를 함께 그린다', async () => {
    render(<PCMainShell />)
    expect(screen.getByTestId('dock-panel')).toBeInTheDocument()
    // 지도는 마운트 즉시 청크를 불러오지만, MapView 자체는 여전히 lazy라
    // Suspense 해제를 기다려야 한다(PC는 "즉시" 로드지 "동기" 로드가 아니다).
    expect(await screen.findByTestId('map-view')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-embedded')).not.toBeInTheDocument()
  })

  it('지도 홈 · 시간표: 도킹 패널 자리에 시간표가 들어오고 지도는 그대로 남는다', async () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell />)
    // 시간표도, 지도도 lazy 라 각각 Suspense 해제를 기다린다.
    expect(await screen.findByTestId('schedule-embedded')).toHaveTextContent('embedded=true')
    expect(await screen.findByTestId('map-view')).toBeInTheDocument()
    expect(screen.queryByTestId('dock-panel')).not.toBeInTheDocument()
  })

  it('시간표 상태에도 지도를 덮는 불투명 오버레이가 없다', () => {
    storeState.homeView = 'timetable'
    const { container } = render(<PCMainShell />)
    expect(container.querySelector('.absolute.inset-0.z-30')).toBeNull()
  })

  it('시간표 패널 안에 지금/시간표 전환이 붙는다', () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell />)
    expect(screen.getByRole('tab', { name: '지금' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '시간표' })).toHaveAttribute('aria-selected', 'true')
  })

  it('다른 페이지(children 있음)에서는 도킹 패널도 시간표도 뜨지 않는다', async () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell><div>FacilitiesPage</div></PCMainShell>)
    expect(screen.queryByTestId('dock-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('schedule-embedded')).not.toBeInTheDocument()
    expect(screen.getByText('FacilitiesPage')).toBeInTheDocument()
    // 지도는 어떤 탭에서도 마운트를 유지한다.
    expect(await screen.findByTestId('map-view')).toBeInTheDocument()
  })

  it('시간표 상태에서는 범례 온보딩을 겹쳐 띄우지 않는다', () => {
    storeState.homeView = 'timetable'
    render(<PCMainShell />)
    expect(screen.queryByTestId('map-legend')).not.toBeInTheDocument()
  })

  // PC는 지도가 첫 화면부터 보이는 레이아웃이라 모바일처럼 펼치는 시점까지
  // 미룰 이유가 없다 — 마운트되는 즉시(대기 조건 없이) LazyMapView를 그린다.
  // 초기 번들에서는 여전히 빠져야 하므로(청크 분리 자체는 유지) 정적 import는
  // 금지하되, gating 없이 곧바로 렌더하는지는 소스에서 확인한다.
  it('MapView.jsx를 정적으로 import하지 않되, 마운트 즉시(대기 없이) LazyMapView를 그린다', () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'PCMainShell.jsx'), 'utf8')
    expect(src).not.toMatch(/from ['"]\.\.\/map\/MapView['"]/)
    expect(src).toMatch(/from ['"]\.\.\/map\/MapView\.lazy['"]/)
    expect(src).toMatch(/<Suspense fallback=\{<MapViewFallback \/>\}>\s*<LazyMapView/)
  })

  describe('지도 필터 ↔ 시간표 모드 단일 출처(selectedMode)', () => {
    it('도킹 패널의 active 필터는 selectedMode를 그대로 따른다', () => {
      storeState.selectedMode = 'shuttle'
      render(<PCMainShell />)
      expect(screen.getByTestId('active-filter')).toHaveTextContent('shuttle')
    })

    it('필터 칩을 누르면 로컬 상태가 아니라 setSelectedMode를 호출한다', () => {
      storeState.selectedMode = 'bus'
      render(<PCMainShell />)
      screen.getByRole('button', { name: '셔틀' }).click()
      expect(storeState.setSelectedMode).toHaveBeenCalledWith('shuttle')
    })

    it('택시 필터인 채로 사이드바가 homeView를 시간표로 바꿔도 도킹 패널이 남는다', () => {
      // 택시는 시간표 개념이 없다(Dashboard.jsx canShowTimetable와 동일 규칙).
      // PCSidebar가 setHomeView('timetable')을 이미 호출한 상황을 store로
      // 흉내낸다 — 이 셸은 selectedMode를 함께 봐서 스케줄을 띄우지 않아야 한다.
      storeState.selectedMode = 'taxi'
      storeState.homeView = 'timetable'
      render(<PCMainShell />)
      expect(screen.getByTestId('dock-panel')).toBeInTheDocument()
      expect(screen.getByTestId('active-filter')).toHaveTextContent('taxi')
      expect(screen.queryByTestId('schedule-embedded')).not.toBeInTheDocument()
    })

    it('택시가 아닌 필터 + 시간표 조합에서는 그대로 시간표가 열린다(회귀 방지)', async () => {
      storeState.selectedMode = 'shuttle'
      storeState.homeView = 'timetable'
      render(<PCMainShell />)
      expect(await screen.findByTestId('schedule-embedded')).toBeInTheDocument()
      expect(screen.queryByTestId('dock-panel')).not.toBeInTheDocument()
    })
  })

  // PCSidebar가 "홈" 아래 "지금"/"시간표" 두 하위 항목을 두던 자리 — 홈과 지금이
  // 동시에 강조돼 두 줄이 같이 칠해졌다. 그 전환 컨트롤을 이 셸의 지도 패널
  // 상단으로 옮겼다(PCSidebar.test.jsx가 사이드바 쪽 하위 메뉴 제거를 고정한다).
  describe('지금/시간표 전환 컨트롤(사이드바에서 이관)', () => {
    it('지금(도킹 패널) 상태에도 지금/시간표 세그먼트가 뜬다', () => {
      render(<PCMainShell />)
      expect(screen.getByTestId('dock-panel')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: '지금' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: '시간표' })).toBeInTheDocument()
    })

    it('지금 상태에서 세그먼트의 "시간표"를 누르면 setHomeView가 호출된다', () => {
      render(<PCMainShell />)
      screen.getByRole('tab', { name: '시간표' }).click()
      expect(storeState.setHomeView).toHaveBeenCalledWith('timetable')
    })

    it('택시 필터에서는 지금/시간표 세그먼트를 아예 숨긴다(시간표 개념 없음)', () => {
      storeState.selectedMode = 'taxi'
      render(<PCMainShell />)
      expect(screen.getByTestId('dock-panel')).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: '지금' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: '시간표' })).not.toBeInTheDocument()
    })

    it('도킹 패널이 접히면 세그먼트도 함께 숨는다(놓을 자리가 없다)', () => {
      render(<PCMainShell />)
      fireEvent.click(screen.getByRole('button', { name: '패널 접기' }))
      expect(screen.getByTestId('panel-collapsed')).toHaveTextContent('true')
      expect(screen.queryByRole('tab', { name: '지금' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: '시간표' })).not.toBeInTheDocument()
    })

    it('다른 페이지(children 있음)에서는 세그먼트도 뜨지 않는다', () => {
      render(<PCMainShell><div>FacilitiesPage</div></PCMainShell>)
      expect(screen.queryByRole('tab', { name: '지금' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: '시간표' })).not.toBeInTheDocument()
    })
  })
})
