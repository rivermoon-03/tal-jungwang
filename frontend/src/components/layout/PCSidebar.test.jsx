import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PCSidebar from './PCSidebar'

vi.mock('../../hooks/useWeather', () => ({
  useWeather: () => ({ weather: null }),
}))
vi.mock('../../hooks/useMore', () => ({
  useNotices: () => ({ data: [] }),
}))
vi.mock('../common/NoticesPopover', () => ({ default: () => null }))

let storeState = {}

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) => selector(storeState)),
}))

function setPath(pathname) {
  window.history.replaceState({}, '', pathname)
}

describe('PCSidebar', () => {
  beforeEach(() => {
    setPath('/')
    storeState = {
      darkMode: false,
      toggleDarkMode: vi.fn(),
      favorites: { routes: [], stations: [], venues: [] },
    }
  })

  it('4개 주요 메뉴(지도/시간표/학식/더보기)를 렌더링한다', () => {
    render(<PCSidebar />)
    expect(screen.getByRole('link', { name: /지도/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /시간표/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /학식/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /더보기/ }).length).toBeGreaterThanOrEqual(1)
  })

  it('현재 경로(/)에서는 지도 탭이 active 상태로 표시된다', () => {
    render(<PCSidebar />)
    const mapLink = screen.getByRole('link', { name: /지도/ })
    expect(mapLink).toHaveAttribute('aria-current', 'page')
  })

  it('/schedule 경로에서는 시간표 탭이 active 상태로 표시된다', () => {
    setPath('/schedule')
    render(<PCSidebar />)
    const scheduleLink = screen.getByRole('link', { name: /시간표/ })
    expect(scheduleLink).toHaveAttribute('aria-current', 'page')
    const mapLink = screen.getByRole('link', { name: /지도/ })
    expect(mapLink).not.toHaveAttribute('aria-current')
  })

  it('즐겨찾기가 없으면 즐겨찾기 섹션을 렌더링하지 않는다', () => {
    render(<PCSidebar />)
    expect(screen.queryByText('즐겨찾기')).not.toBeInTheDocument()
  })

  it('즐겨찾기 노선이 있으면 목록에 렌더링한다', () => {
    storeState = {
      ...storeState,
      favorites: { routes: ['3400', 'subway:정왕:up'], stations: [], venues: [] },
    }
    render(<PCSidebar />)
    expect(screen.getByText('즐겨찾기')).toBeInTheDocument()
    expect(screen.getByText('3400')).toBeInTheDocument()
    expect(screen.getByText('정왕 up')).toBeInTheDocument()
  })

  it('다크모드 토글 버튼 클릭 시 toggleDarkMode를 호출한다', () => {
    render(<PCSidebar />)
    const toggleBtn = screen.getByTitle('다크 모드로')
    toggleBtn.click()
    expect(storeState.toggleDarkMode).toHaveBeenCalled()
  })
})
