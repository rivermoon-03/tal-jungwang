import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PCMapDockPanel from './PCMapDockPanel'

vi.mock('../dashboard/PCStationPicker', () => ({
  default: () => <div data-testid="pc-station-picker">PCStationPicker</div>,
}))

vi.mock('../dashboard/StationPills', () => ({
  default: ({ mode }) => <div data-testid="station-pills">StationPills mode={mode}</div>,
}))

vi.mock('../summary/ShuttlePanel', () => ({
  default: () => <div data-testid="shuttle-panel">ShuttlePanel</div>,
}))

vi.mock('../summary/SubwayPanel', () => ({
  default: ({ dataMode }) => <div data-testid="subway-panel">SubwayPanel dataMode={dataMode}</div>,
}))

const FILTERS = [
  { id: 'bus', label: '버스', active: true },
  { id: 'shuttle', label: '셔틀', active: false },
]

const SHUTTLE_FILTERS = [
  { id: 'bus', label: '버스', active: false },
  { id: 'shuttle', label: '셔틀', active: true },
  { id: 'subway', label: '지하철', active: false },
]

const SUBWAY_FILTERS = [
  { id: 'bus', label: '버스', active: false },
  { id: 'shuttle', label: '셔틀', active: false },
  { id: 'subway', label: '지하철', active: true },
]

const ROUTES = [
  { id: 'r1', badge: '직', color: '#dc2626', name: '3400 광역급행', etaText: '7분' },
]

const PRIMARY = {
  routeName: '3400 학교행',
  direction: '강남역 방면',
  etaText: '17',
}

describe('PCMapDockPanel', () => {
  it('검색, 정류장 선택, 도착 목록 섹션을 모두 렌더한다', () => {
    render(
      <PCMapDockPanel
        collapsed={false}
        onToggleCollapsed={() => {}}
        search=""
        onChangeSearch={() => {}}
        filters={FILTERS}
        onToggleFilter={() => {}}
        stationLabel="정왕역 정류장"
        statusLabel="여유"
        statusTone="ease"
        primary={PRIMARY}
        routes={ROUTES}
      />
    )
    expect(screen.getByPlaceholderText('노선·정류장 검색')).toBeInTheDocument()
    expect(screen.getByTestId('pc-station-picker')).toBeInTheDocument()
    expect(screen.getByText('정왕역 정류장')).toBeInTheDocument()
    expect(screen.getByText('3400 광역급행')).toBeInTheDocument()
  })

  it('검색어 입력 시 onChangeSearch가 호출된다', () => {
    const onChangeSearch = vi.fn()
    render(
      <PCMapDockPanel
        collapsed={false}
        onToggleCollapsed={() => {}}
        search=""
        onChangeSearch={onChangeSearch}
        filters={FILTERS}
        stationLabel="정왕역 정류장"
        primary={PRIMARY}
        routes={ROUTES}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('노선·정류장 검색'), { target: { value: '33' } })
    expect(onChangeSearch).toHaveBeenCalledWith('33')
  })

  it('접기 버튼 클릭 시 onToggleCollapsed가 호출된다', () => {
    const onToggleCollapsed = vi.fn()
    render(
      <PCMapDockPanel
        collapsed={false}
        onToggleCollapsed={onToggleCollapsed}
        search=""
        onChangeSearch={() => {}}
        filters={FILTERS}
        stationLabel="정왕역 정류장"
        primary={PRIMARY}
        routes={ROUTES}
      />
    )
    fireEvent.click(screen.getByLabelText('지도 패널 접기'))
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
  })

  it('collapsed=true이면 얇은 재열기 탭만 렌더하고 본문은 렌더하지 않는다', () => {
    const onToggleCollapsed = vi.fn()
    render(
      <PCMapDockPanel
        collapsed
        onToggleCollapsed={onToggleCollapsed}
        search=""
        onChangeSearch={() => {}}
        filters={FILTERS}
        stationLabel="정왕역 정류장"
        primary={PRIMARY}
        routes={ROUTES}
      />
    )
    expect(screen.queryByPlaceholderText('노선·정류장 검색')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pc-station-picker')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('지도 패널 펼치기'))
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
  })

  // 결함 — 셔틀/지하철 필터를 누르면 "준비 중" 빈 상태만 뜨고 실제 정보가
  // 보이지 않았다. 모바일이 이미 쓰는 ShuttlePanel/SubwayPanel을 재사용해
  // 대표 도착 카드(MapBottomCard, 버스 전용) 대신 그 자리에 그린다.
  it('셔틀 필터가 활성이면 ShuttlePanel과 캠퍼스 선택을 렌더하고 버스 전용 카드는 렌더하지 않는다', () => {
    render(
      <PCMapDockPanel
        collapsed={false}
        onToggleCollapsed={() => {}}
        search=""
        onChangeSearch={() => {}}
        filters={SHUTTLE_FILTERS}
        onToggleFilter={() => {}}
        stationLabel="정왕역 정류장"
        primary={{}}
        routes={[]}
        emptyState={{ title: '셔틀 정보는 준비 중이에요', description: '...' }}
      />
    )
    expect(screen.getByTestId('shuttle-panel')).toBeInTheDocument()
    expect(screen.getByTestId('station-pills')).toHaveTextContent('mode=shuttle')
    expect(screen.queryByTestId('pc-station-picker')).not.toBeInTheDocument()
    expect(screen.queryByText('셔틀 정보는 준비 중이에요')).not.toBeInTheDocument()
  })

  it('지하철 필터가 활성이면 SubwayPanel과 역 선택을 렌더하고 버스 전용 카드는 렌더하지 않는다', () => {
    render(
      <PCMapDockPanel
        collapsed={false}
        onToggleCollapsed={() => {}}
        search=""
        onChangeSearch={() => {}}
        filters={SUBWAY_FILTERS}
        onToggleFilter={() => {}}
        stationLabel="정왕역"
        primary={{}}
        routes={[]}
        emptyState={{ title: '지하철 정보는 준비 중이에요', description: '...' }}
      />
    )
    expect(screen.getByTestId('subway-panel')).toHaveTextContent('dataMode=timetable')
    expect(screen.getByTestId('station-pills')).toHaveTextContent('mode=subway')
    expect(screen.queryByTestId('pc-station-picker')).not.toBeInTheDocument()
    expect(screen.queryByText('지하철 정보는 준비 중이에요')).not.toBeInTheDocument()
  })

  it('버스 필터가 활성이면 여전히 정류장 picker와 MapBottomCard를 렌더한다(회귀 방지)', () => {
    render(
      <PCMapDockPanel
        collapsed={false}
        onToggleCollapsed={() => {}}
        search=""
        onChangeSearch={() => {}}
        filters={FILTERS}
        onToggleFilter={() => {}}
        stationLabel="정왕역 정류장"
        primary={PRIMARY}
        routes={ROUTES}
      />
    )
    expect(screen.getByTestId('pc-station-picker')).toBeInTheDocument()
    expect(screen.getByText('3400 광역급행')).toBeInTheDocument()
    expect(screen.queryByTestId('shuttle-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('subway-panel')).not.toBeInTheDocument()
  })
})
