import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import MainTab from './MainTab'

beforeAll(() => {
  import.meta.env.VITE_KAKAO_JS_APP_KEY = ''
})

// Dashboard 내부 의존성(useAppStore, 각종 훅)을 모두 차단
vi.mock('../dashboard/Dashboard', () => ({
  default: () => <div data-testid="dashboard-mock" />,
}))

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      activeTab: 'main',
      setActiveTab: vi.fn(),
      selectedStationId: null,
      setSelectedStationId: vi.fn(),
      userLocation: null,
      setUserLocation: vi.fn(),
      selectedMode: 'bus',
      setSelectedMode: vi.fn(),
      driveRouteCoords: null,
      setDriveRouteCoords: vi.fn(),
      mapPanTarget: null,
      setMapPanTarget: vi.fn(),
      walkRoute: null,
      setWalkRoute: vi.fn(),
      setDetailModal: vi.fn(),
      setScheduleHint: vi.fn(),
    }),
}))

vi.mock('../../hooks/useRecommend', () => ({
  useRecommend: () => ({ data: null, loading: false, error: null }),
}))
vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: () => ({ data: null, loading: false, error: null }),
  useBusStations: () => ({ data: null }),
  useBusTimetableByRoute: () => ({ data: null }),
}))
vi.mock('../../hooks/useSubway', () => ({
  useSubwayNext: () => ({ data: null, loading: false, error: null }),
  useSubwayTimetable: () => ({ data: null }),
}))
vi.mock('../../hooks/useShuttle', () => ({
  useShuttleNext: () => ({ data: null, loading: false, error: null }),
  useShuttleSchedule: () => ({ data: null }),
}))
vi.mock('../../hooks/useMapMarkers', () => ({
  useMapMarkers: () => ({ data: null }),
}))

describe('MainTab', () => {
  it('API 키 없을 때 placeholder 렌더링', () => {
    render(<MainTab />)
    expect(screen.getByText(/카카오맵/)).toBeInTheDocument()
  })

  it('플로팅 대시보드가 렌더링된다', () => {
    render(<MainTab />)
    expect(screen.getByTestId('dashboard-mock')).toBeInTheDocument()
  })

  it('접기 버튼 클릭 시 dashboard가 숨고 모드 배지가 표시된다', () => {
    render(<MainTab />)
    const collapseBtn = screen.getByRole('button', { name: '대시보드 접기' })
    fireEvent.click(collapseBtn)
    expect(screen.queryByTestId('dashboard-mock')).not.toBeInTheDocument()
    expect(screen.getByText('버스')).toBeInTheDocument()
  })

  it('펼치기 버튼 클릭 시 dashboard가 다시 보인다', () => {
    render(<MainTab />)
    const collapseBtn = screen.getByRole('button', { name: '대시보드 접기' })
    fireEvent.click(collapseBtn)
    const expandBtn = screen.getByRole('button', { name: '대시보드 펼치기' })
    fireEvent.click(expandBtn)
    expect(screen.getByTestId('dashboard-mock')).toBeInTheDocument()
  })
})
