import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PCMapDockPanel from './PCMapDockPanel'

vi.mock('../dashboard/PCStationPicker', () => ({
  default: () => <div data-testid="pc-station-picker">PCStationPicker</div>,
}))

const FILTERS = [
  { id: 'bus', label: '버스', active: true },
  { id: 'shuttle', label: '셔틀', active: false },
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
})
