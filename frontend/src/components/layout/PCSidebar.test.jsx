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
      pcCafeteriaTab: 'diet',
      setPcCafeteriaTab: vi.fn(),
      pcMoreNav: 'academic',
      setPcMoreNav: vi.fn(),
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

  it('설정 섹션에 설정/앱 정보/개인정보처리방침 3항목을 렌더한다', () => {
    render(<PCSidebar />)
    expect(screen.getByRole('link', { name: /^설정$/ })).toHaveAttribute('href', '/more/settings')
    expect(screen.getByRole('link', { name: /앱 정보/ })).toHaveAttribute('href', '/more/app-info')
    expect(screen.getByRole('link', { name: /개인정보처리방침/ })).toHaveAttribute('href', '/privacy')
  })

  describe('컨텍스트 서브내비 — 학식', () => {
    beforeEach(() => {
      setPath('/cafeteria')
    })

    it('학식 탭이 활성일 때 식단/운영정보 하위 메뉴를 렌더하고, store 기준으로 활성 표시한다', () => {
      render(<PCSidebar />)
      const diet = screen.getByRole('link', { name: '식단' })
      const venues = screen.getByRole('link', { name: '운영정보' })
      expect(diet).toHaveAttribute('aria-current', 'page')
      expect(venues).not.toHaveAttribute('aria-current')
    })

    it('운영정보를 클릭하면 setPcCafeteriaTab이 venues로 호출된다', () => {
      render(<PCSidebar />)
      screen.getByRole('link', { name: '운영정보' }).click()
      expect(storeState.setPcCafeteriaTab).toHaveBeenCalledWith('venues')
    })

    it('다른 탭(더보기)에서는 학식 서브내비가 보이지 않는다', () => {
      setPath('/more')
      render(<PCSidebar />)
      expect(screen.queryByRole('link', { name: '식단' })).not.toBeInTheDocument()
    })
  })

  describe('컨텍스트 서브내비 — 더보기', () => {
    beforeEach(() => {
      setPath('/more')
    })

    it('더보기 탭이 활성일 때 학사공지/앱 공지 하위 메뉴를 렌더하고, store 기준으로 활성 표시한다', () => {
      render(<PCSidebar />)
      const academic = screen.getByRole('link', { name: '학사공지' })
      const notices = screen.getByRole('link', { name: '앱 공지' })
      expect(academic).toHaveAttribute('aria-current', 'page')
      expect(notices).not.toHaveAttribute('aria-current')
    })

    it('앱 공지를 클릭하면 setPcMoreNav가 notices로 호출된다', () => {
      render(<PCSidebar />)
      screen.getByRole('link', { name: '앱 공지' }).click()
      expect(storeState.setPcMoreNav).toHaveBeenCalledWith('notices')
    })
  })
})
