import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// useAppStore mock — selector 기반으로 state를 주입한다
const mockState = {
  selectedMode: 'bus',
  setSelectedMode: vi.fn(),
}

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector(mockState),
}))

import ModeTabs from './ModeTabs'

describe('ModeTabs', () => {
  it('버스/지하철/셔틀/택시 탭을 렌더한다', () => {
    render(<ModeTabs />)
    expect(screen.getByRole('tab', { name: '버스' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '지하철' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '셔틀' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '택시' })).toBeInTheDocument()
  })

  it('selectedMode=bus 일 때 버스 탭이 aria-selected=true', () => {
    render(<ModeTabs />)
    expect(screen.getByRole('tab', { name: '버스' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '지하철' })).toHaveAttribute('aria-selected', 'false')
  })

  it('탭 클릭 시 setSelectedMode(id)를 호출한다', () => {
    mockState.setSelectedMode.mockClear()
    render(<ModeTabs />)
    fireEvent.click(screen.getByRole('tab', { name: '지하철' }))
    expect(mockState.setSelectedMode).toHaveBeenCalledWith('subway')
  })

  it('셔틀 탭 클릭 시 setSelectedMode("shuttle")를 호출한다', () => {
    mockState.setSelectedMode.mockClear()
    render(<ModeTabs />)
    fireEvent.click(screen.getByRole('tab', { name: '셔틀' }))
    expect(mockState.setSelectedMode).toHaveBeenCalledWith('shuttle')
  })

  it('role="tablist"을 가진다', () => {
    render(<ModeTabs />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})
