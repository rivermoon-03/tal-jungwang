import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MobileTabBar from './MobileTabBar'

const mockSetActiveTab = vi.fn()
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({
    activeTab: 'main',
    setActiveTab: mockSetActiveTab,
  }),
}))

describe('MobileTabBar', () => {
  it('4개 탭 렌더링', () => {
    render(<MobileTabBar />)
    expect(screen.getByText('지도')).toBeInTheDocument()
    expect(screen.getByText('셔틀')).toBeInTheDocument()
    expect(screen.getByText('버스')).toBeInTheDocument()
    expect(screen.getByText('지하철')).toBeInTheDocument()
  })

  it('탭 클릭 시 setActiveTab 호출', () => {
    render(<MobileTabBar />)
    fireEvent.click(screen.getByText('셔틀'))
    expect(mockSetActiveTab).toHaveBeenCalledWith('shuttle')
  })
})
