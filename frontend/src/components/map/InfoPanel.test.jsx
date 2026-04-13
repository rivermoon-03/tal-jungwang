// frontend/src/components/map/InfoPanel.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InfoPanel from './InfoPanel'

vi.mock('./InfoPanelMobile', () => ({
  default: () => <div data-testid="mobile-panel" />,
}))
vi.mock('./InfoPanelPC', () => ({
  default: () => <div data-testid="pc-panel" />,
}))
vi.mock('../../hooks/useSubway', () => ({
  useSubwayNext: () => ({ data: null, loading: false, error: null }),
}))
vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: () => ({ data: null, loading: false, error: null }),
}))
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({ userLocation: null }),
}))

describe('InfoPanel', () => {
  it('모바일 너비에서 InfoPanelMobile이 렌더링된다', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    render(<InfoPanel />)
    expect(screen.getByTestId('mobile-panel')).toBeInTheDocument()
  })

  it('PC 너비에서 InfoPanelPC가 렌더링된다', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true })
    render(<InfoPanel />)
    expect(screen.getByTestId('pc-panel')).toBeInTheDocument()
  })
})
