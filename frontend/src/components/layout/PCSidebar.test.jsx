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
      pcMoreNav: 'settings',
      setPcMoreNav: vi.fn(),
      pcNoticesTab: 'academic',
      setPcNoticesTab: vi.fn(),
      homeView: 'now',
      setHomeView: vi.fn(),
      setDetailModal: vi.fn(),
    }
  })

  // PC 상위 탭 라벨을 모바일 FloatingDock과 맞췄다(둘 다 '홈') — 같은 화면인데
  // PC만 '지도'라 이름이 갈리던 자리(요구사항: 모바일·PC 상위 탭 이름 일치).
  it('4개 주요 메뉴(홈/학교시설/공지/더보기)를 렌더링한다', () => {
    render(<PCSidebar />)
    expect(screen.getByRole('link', { name: /^홈$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /학교시설/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /공지/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /더보기/ }).length).toBeGreaterThanOrEqual(1)
  })

  it('현재 경로(/)에서는 홈 탭이 active 상태로 표시된다', () => {
    render(<PCSidebar />)
    const mapLink = screen.getByRole('link', { name: /^홈$/ })
    expect(mapLink).toHaveAttribute('aria-current', 'page')
  })

  it('/schedule 은 홈 탭의 하위 보기라 홈이 active로 남는다', () => {
    setPath('/schedule')
    render(<PCSidebar />)
    // 시간표는 별도 탭이 아니라 같은 교통 정보의 다른 관점이다.
    expect(screen.getByRole('link', { name: /^홈$/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '시간표' })).toBeInTheDocument()
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

  describe('컨텍스트 서브내비 — 학교시설', () => {
    beforeEach(() => {
      setPath('/facilities')
    })

    it('학교시설 탭이 활성일 때 학식/매장/도서관 하위 메뉴를 렌더한다', () => {
      render(<PCSidebar />)
      expect(screen.getByRole('link', { name: '학식' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: '매장' })).not.toHaveAttribute('aria-current')
      expect(screen.getByRole('link', { name: '도서관' })).toBeInTheDocument()
    })

    it('매장을 클릭하면 setPcCafeteriaTab이 venues로 호출된다', () => {
      render(<PCSidebar />)
      screen.getByRole('link', { name: '매장' }).click()
      expect(storeState.setPcCafeteriaTab).toHaveBeenCalledWith('venues')
    })

    it('다른 탭(더보기)에서는 학교시설 서브내비가 보이지 않는다', () => {
      setPath('/more')
      render(<PCSidebar />)
      expect(screen.queryByRole('link', { name: '학식' })).not.toBeInTheDocument()
    })
  })

  describe('컨텍스트 서브내비 — 공지', () => {
    beforeEach(() => {
      setPath('/notices')
    })

    it('공지 탭이 활성일 때 학사공지/앱 공지 하위 메뉴를 렌더한다', () => {
      render(<PCSidebar />)
      expect(screen.getByRole('link', { name: '학사공지' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: '앱 공지' })).not.toHaveAttribute('aria-current')
    })

    it('앱 공지를 클릭하면 setPcNoticesTab이 app으로 호출된다', () => {
      render(<PCSidebar />)
      screen.getByRole('link', { name: '앱 공지' }).click()
      expect(storeState.setPcNoticesTab).toHaveBeenCalledWith('app')
    })
  })

  describe('컨텍스트 서브내비 — 지도', () => {
    it('지도 탭에는 지금/시간표 보기 전환이 붙는다', () => {
      render(<PCSidebar />)
      expect(screen.getByRole('link', { name: '지금' })).toHaveAttribute('aria-current', 'page')
      screen.getByRole('link', { name: '시간표' }).click()
      expect(storeState.setHomeView).toHaveBeenCalledWith('timetable')
    })

    // 예전에는 "시간표"만 /schedule 로 pushState 해서, PCMainShell 의
    // showFloating(=!children) 이 꺼지며 도킹 패널이 unmount 되고 지도가 통째로
    // 불투명 페이지에 덮였다. 지도 탭의 하위 보기이므로 주소는 지도 홈에 머문다.
    it('시간표를 눌러도 /schedule 로 페이지 이동하지 않는다', () => {
      render(<PCSidebar />)
      screen.getByRole('link', { name: '시간표' }).click()
      expect(storeState.setHomeView).toHaveBeenCalledWith('timetable')
      expect(window.location.pathname).toBe('/')
    })
  })

  describe('즐겨찾기', () => {
    // 모든 행이 goSettings 에 묶여 있어 무엇을 눌러도 /more 로 가던 자리다.
    it('버스 즐겨찾기를 누르면 해당 노선 상세를 연다', () => {
      storeState.favorites = { routes: ['하교:3400'], stations: [], venues: [] }
      render(<PCSidebar />)
      screen.getByRole('button', { name: /3400/ }).click()
      expect(storeState.setDetailModal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'bus', routeCode: '3400', favCode: '하교:3400' })
      )
      expect(window.location.pathname).toBe('/')
    })

    it('지하철 즐겨찾기도 상세로 연결된다', () => {
      storeState.favorites = { routes: ['subway:정왕:up'], stations: [], venues: [] }
      render(<PCSidebar />)
      screen.getByRole('button', { name: /정왕/ }).click()
      expect(storeState.setDetailModal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'subway', station: '정왕', dir: 'up' })
      )
    })

    it('즐겨찾기 행은 44px 이상 터치 영역을 갖는다', () => {
      storeState.favorites = { routes: ['하교:3400'], stations: [], venues: [] }
      render(<PCSidebar />)
      expect(screen.getByRole('button', { name: /3400/ }).className).toContain('min-h-[44px]')
    })
  })
})
