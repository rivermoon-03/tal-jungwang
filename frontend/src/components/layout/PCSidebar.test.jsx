import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PCSidebar from './PCSidebar'

const mockSetActiveTab = vi.fn()
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({
    activeTab: 'main',
    setActiveTab: mockSetActiveTab,
  }),
}))

describe('PCSidebar', () => {
  it('로고 텍스트 렌더링', () => {
    render(<PCSidebar />)
    expect(screen.getByText(/정왕/)).toBeInTheDocument()
  })

  it('4개 탭 메뉴 렌더링', () => {
    render(<PCSidebar />)
    expect(screen.getByText('메인 지도')).toBeInTheDocument()
    expect(screen.getByText('셔틀버스')).toBeInTheDocument()
    expect(screen.getByText('버스')).toBeInTheDocument()
    expect(screen.getByText('지하철')).toBeInTheDocument()
  })

  it('탭 클릭 시 setActiveTab 호출', () => {
    render(<PCSidebar />)
    fireEvent.click(screen.getByText('셔틀버스'))
    expect(mockSetActiveTab).toHaveBeenCalledWith('shuttle')
  })
})
