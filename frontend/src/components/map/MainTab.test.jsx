import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import MainTab from './MainTab'

beforeAll(() => {
  import.meta.env.VITE_KAKAO_JS_APP_KEY = ''
})

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({
    activeTab: 'main',
    setActiveTab: vi.fn(),
    selectedStationId: null,
    setSelectedStationId: vi.fn(),
    userLocation: null,
    setUserLocation: vi.fn(),
  }),
}))

vi.mock('../../hooks/useRecommend', () => ({
  useRecommend: () => ({ data: null, loading: false, error: null }),
}))

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: () => ({
    data: null,
    loading: false,
    error: null,
  }),
}))

vi.mock('../../hooks/useSubway', () => ({
  useSubwayNext: () => ({ data: null, loading: false, error: null }),
}))

describe('MainTab', () => {
  it('API 키 없을 때 placeholder 렌더링', () => {
    render(<MainTab />)
    expect(screen.getByText(/카카오맵/)).toBeInTheDocument()
  })
})
