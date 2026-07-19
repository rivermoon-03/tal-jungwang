/**
 * SearchOverlay — 실제 useAppStore를 그대로 쓰고 beforeEach에서 상태만 초기화한다
 * (SettingsPage.test.jsx와 동일 전략). selector가 많아 전체 모킹보다 실제 스토어가
 * add/removeRecentSearch 같은 리듀서 로직까지 함께 검증돼 더 안전하다.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import SearchOverlay from './SearchOverlay'
import useAppStore from '../../stores/useAppStore'

function setPath(pathname) {
  window.history.replaceState({}, '', pathname)
}

beforeEach(() => {
  setPath('/')
  useAppStore.setState({
    searchOpen: false,
    recentSearches: [],
    activeTab: 'main',
    selectedBusStation: '한국공학대',
    selectedSubwayStation: '정왕',
    selectedShuttleCampus: 'main',
    selectedMode: 'bus',
  })
})

describe('SearchOverlay — 열림/닫힘', () => {
  it('searchOpen=false면 아무것도 렌더하지 않는다', () => {
    render(<SearchOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('searchOpen=true면 검색 입력과 취소 버튼이 보인다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '노선·정류장 검색' })).toBeInTheDocument()
    expect(screen.getByText('취소')).toBeInTheDocument()
  })

  it('"취소" 클릭 시 searchOpen이 false가 된다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    fireEvent.click(screen.getByText('취소'))
    expect(useAppStore.getState().searchOpen).toBe(false)
  })

  it('ESC 키로 닫힌다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useAppStore.getState().searchOpen).toBe(false)
  })

  it('뒤로가기(popstate)로 닫힌다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(useAppStore.getState().searchOpen).toBe(false)
  })
})

describe('SearchOverlay — 결과 렌더', () => {
  it('"34" 입력 시 3400/3401 노선 결과가 보인다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    fireEvent.change(screen.getByRole('textbox', { name: '노선·정류장 검색' }), {
      target: { value: '34' },
    })
    // RouteBadge + 라벨 텍스트가 각각 "3400"을 렌더하므로 getAllByText로 확인한다.
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3401').length).toBeGreaterThan(0)
  })

  it('"정왕" 입력 시 정왕역 결과가 보인다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    fireEvent.change(screen.getByRole('textbox', { name: '노선·정류장 검색' }), {
      target: { value: '정왕' },
    })
    expect(screen.getByText('정왕역')).toBeInTheDocument()
  })

  it('일치 결과가 없으면 안내 문구를 보여준다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    fireEvent.change(screen.getByRole('textbox', { name: '노선·정류장 검색' }), {
      target: { value: '존재하지않는검색어xyz' },
    })
    expect(screen.getByText('일치하는 결과가 없어요')).toBeInTheDocument()
  })

  it('입력이 비어 있고 최근 검색이 없으면 안내 문구를 보여준다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    expect(screen.getByText('최근 검색한 노선·정류장이 여기에 표시돼요.')).toBeInTheDocument()
  })
})

describe('SearchOverlay — 결과 선택', () => {
  it('노선 결과를 탭하면 /route/bus:{id}로 이동하고 최근 검색에 추가되며 닫힌다', () => {
    useAppStore.setState({ searchOpen: true })
    render(<SearchOverlay />)
    fireEvent.change(screen.getByRole('textbox', { name: '노선·정류장 검색' }), {
      target: { value: '3400' },
    })
    fireEvent.click(screen.getAllByText('3400')[0])

    expect(window.location.pathname).toBe('/route/bus:3400')
    expect(useAppStore.getState().searchOpen).toBe(false)
    expect(useAppStore.getState().recentSearches[0]).toMatchObject({ type: 'route', id: '3400' })
  })

  it('정류장 결과를 탭하면 버스 모드 + 정류장 선택 후 홈으로 이동한다', () => {
    setPath('/schedule')
    useAppStore.setState({ searchOpen: true, selectedBusStation: '이마트' })
    render(<SearchOverlay />)
    fireEvent.change(screen.getByRole('textbox', { name: '노선·정류장 검색' }), {
      target: { value: '본캠' },
    })
    fireEvent.click(screen.getByText('본캠'))

    expect(useAppStore.getState().selectedMode).toBe('bus')
    expect(useAppStore.getState().selectedBusStation).toBe('한국공학대')
    expect(window.location.pathname).toBe('/')
    expect(useAppStore.getState().activeTab).toBe('map')
  })

  it('지하철 결과를 탭하면 지하철 모드로 전환되고 지원 역이면 선택도 반영한다', () => {
    useAppStore.setState({ searchOpen: true, selectedSubwayStation: '초지' })
    render(<SearchOverlay />)
    fireEvent.change(screen.getByRole('textbox', { name: '노선·정류장 검색' }), {
      target: { value: '정왕' },
    })
    fireEvent.click(screen.getByText('정왕역'))

    expect(useAppStore.getState().selectedMode).toBe('subway')
    expect(useAppStore.getState().selectedSubwayStation).toBe('정왕')
  })
})

describe('SearchOverlay — 최근 검색', () => {
  it('최근 검색 행을 탭하면 다시 검색/이동이 수행된다', () => {
    useAppStore.setState({
      searchOpen: true,
      recentSearches: [{ type: 'route', id: '5602', label: '5602', sub: '버스 노선' }],
    })
    render(<SearchOverlay />)
    fireEvent.click(screen.getByText('5602'))
    expect(window.location.pathname).toBe('/route/bus:5602')
    expect(useAppStore.getState().searchOpen).toBe(false)
  })

  it('개별 삭제(X) 버튼으로 최근 검색 항목을 지울 수 있다', () => {
    useAppStore.setState({
      searchOpen: true,
      recentSearches: [{ type: 'route', id: '5602', label: '5602', sub: '버스 노선' }],
    })
    render(<SearchOverlay />)
    fireEvent.click(screen.getByRole('button', { name: '5602 최근 검색 삭제' }))
    expect(useAppStore.getState().recentSearches).toHaveLength(0)
  })

  it('최근 검색은 최대 5건까지만 유지되고 최신이 앞에 온다', () => {
    const { addRecentSearch } = useAppStore.getState()
    act(() => {
      for (let i = 0; i < 6; i++) {
        addRecentSearch({ type: 'route', id: `R${i}`, label: `R${i}`, sub: '버스 노선' })
      }
    })
    const list = useAppStore.getState().recentSearches
    expect(list).toHaveLength(5)
    expect(list[0].id).toBe('R5')
    expect(list.map((e) => e.id)).not.toContain('R0')
  })

  it('같은 항목을 다시 검색하면 중복 없이 맨 앞으로 재정렬된다', () => {
    const { addRecentSearch } = useAppStore.getState()
    act(() => {
      addRecentSearch({ type: 'route', id: 'A', label: 'A', sub: '버스 노선' })
      addRecentSearch({ type: 'route', id: 'B', label: 'B', sub: '버스 노선' })
      addRecentSearch({ type: 'route', id: 'A', label: 'A', sub: '버스 노선' })
    })
    const list = useAppStore.getState().recentSearches
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe('A')
    expect(list[1].id).toBe('B')
  })
})
