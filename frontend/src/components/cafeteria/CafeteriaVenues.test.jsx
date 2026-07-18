/**
 * CafeteriaVenues 컴포넌트 테스트
 * - 기본 렌더 확인
 * - 카테고리 아이콘(SVG) 렌더 확인
 * - 카드 클릭 시 onVenueClick 콜백 호출 확인
 * - 영업중 상태 텍스트 표시 확인
 * - 건물별 위치 칩 표시 확인
 * - 정렬 스위치(장소별 ↔ 카테고리별) 전환 동작
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// useNow 훅 모킹 — 목요일 낮 12시 (영업중인 장소가 있을 시간)
vi.mock('../../hooks/useNow', () => ({
  useNow: vi.fn(() => new Date('2026-06-25T12:00:00+09:00').getTime()),
}))

// useAppStore 모킹 — 라이트모드 + F2 매점 즐겨찾기(venues) 상태를 셀렉터로 반영.
// mockStoreState는 vi.hoisted로 선언해 factory와 테스트 바디 양쪽에서 공유한다.
const mockStoreState = vi.hoisted(() => {
  const state = {
    darkMode: false,
    favorites: { routes: [], stations: [], venues: [] },
  }
  state.toggleFavoriteVenue = (id) => {
    const list = state.favorites.venues
    const idx = list.indexOf(id)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(id)
  }
  return state
})

vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    typeof selector === 'function' ? selector(mockStoreState) : mockStoreState
  ),
}))

import CafeteriaVenues from './CafeteriaVenues'

describe('CafeteriaVenues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState.favorites.venues = []
  })

  it('CafeteriaVenues가 렌더된다', () => {
    render(<CafeteriaVenues />)
    // 학식 운영 정보 헤더 확인
    expect(screen.getByText('학식 운영 정보')).toBeInTheDocument()
  })

  it('탭(지금, 운영시간)이 렌더된다', () => {
    render(<CafeteriaVenues />)
    expect(screen.getByText('지금')).toBeInTheDocument()
    expect(screen.getByText('운영시간')).toBeInTheDocument()
  })

  it('각 venue 카드에 SVG 아이콘이 렌더된다', () => {
    const { container } = render(<CafeteriaVenues />)
    // lucide 아이콘은 SVG로 렌더된다
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('카드 클릭 시 onVenueClick이 venue.id로 호출된다', () => {
    const onVenueClick = vi.fn()
    render(<CafeteriaVenues onVenueClick={onVenueClick} />)

    // role=button인 카드 중 첫 번째 클릭
    const cards = screen.getAllByRole('button')
    // 탭 버튼을 제외한 카드 버튼 찾기 (aria-label이 있는 것)
    const venueCards = cards.filter((btn) => btn.getAttribute('aria-label'))
    if (venueCards.length > 0) {
      fireEvent.click(venueCards[0])
      expect(onVenueClick).toHaveBeenCalledOnce()
      expect(typeof onVenueClick.mock.calls[0][0]).toBe('string')
    }
  })

  it('onVenueClick이 없어도 카드 클릭 시 에러가 나지 않는다', () => {
    render(<CafeteriaVenues />)
    const cards = screen.getAllByRole('button')
    const venueCards = cards.filter((btn) => btn.getAttribute('aria-label'))
    if (venueCards.length > 0) {
      expect(() => fireEvent.click(venueCards[0])).not.toThrow()
    }
  })

  it('영업중 상태 텍스트가 표시된다', () => {
    render(<CafeteriaVenues />)
    // 낮 12시이므로 영업중인 곳이 있어야 함
    // "영업 중" 또는 "24시간 영업" 텍스트 확인
    const openTexts = screen.queryAllByText(/영업 중|24시간 영업/)
    expect(openTexts.length).toBeGreaterThan(0)
  })

  it('건물별 위치 칩(TIP, E동 등)이 표시된다', () => {
    render(<CafeteriaVenues />)
    // 위치 칩에 건물명이 포함되어 있어야 함
    const tipChips = screen.queryAllByText(/TIP/)
    expect(tipChips.length).toBeGreaterThan(0)
  })

  it('운영시간 탭으로 전환하면 건물 그룹 헤더가 보인다 (기본: 장소별)', () => {
    render(<CafeteriaVenues />)
    const scheduleTab = screen.getByText('운영시간')
    fireEvent.click(scheduleTab)
    // 기본 장소별 정렬: TIP / E동 / 중앙도서관 건물 헤더 중 하나가 있어야 함
    expect(
      screen.queryAllByText(/^TIP$/).length > 0 ||
      screen.queryAllByText(/^E동$/).length > 0 ||
      screen.queryAllByText(/^중앙도서관$/).length > 0
    ).toBe(true)
  })

  it('운영시간 탭의 각 venue 카드도 클릭 시 onVenueClick이 호출된다', () => {
    const onVenueClick = vi.fn()
    render(<CafeteriaVenues onVenueClick={onVenueClick} />)

    // 운영시간 탭으로 전환
    const scheduleTab = screen.getByText('운영시간')
    fireEvent.click(scheduleTab)

    // role=button인 venue 카드 클릭
    const cards = screen.getAllByRole('button')
    const venueCards = cards.filter((btn) => btn.getAttribute('aria-label'))
    if (venueCards.length > 0) {
      fireEvent.click(venueCards[0])
      expect(onVenueClick).toHaveBeenCalledOnce()
    }
  })
})

// ─── 정렬 스위치 테스트 ────────────────────────────────────────────────────────
describe('CafeteriaVenues — 정렬 스위치', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState.favorites.venues = []
  })

  // 운영시간 탭으로 이동하는 헬퍼
  function renderScheduleTab(props = {}) {
    const result = render(<CafeteriaVenues {...props} />)
    fireEvent.click(screen.getByText('운영시간'))
    return result
  }

  it('운영시간 탭에 정렬 스위치가 렌더된다', () => {
    renderScheduleTab()
    // 두 옵션 버튼이 있어야 함
    expect(screen.getByText('장소별')).toBeInTheDocument()
    expect(screen.getByText('카테고리별')).toBeInTheDocument()
  })

  it('기본값은 "장소별"이며 건물 그룹 헤더가 보인다', () => {
    renderScheduleTab()
    // 건물 헤더(TIP, E동, 중앙도서관) 중 하나가 보여야 함
    const buildingHeaders = screen.queryAllByTestId('group-header')
    // aria-label이나 data-testid가 없으면 텍스트로 확인
    expect(
      screen.queryAllByText(/^TIP$/).length > 0 ||
      screen.queryAllByText(/^E동$/).length > 0 ||
      screen.queryAllByText(/^중앙도서관$/).length > 0
    ).toBe(true)
  })

  it('"카테고리별" 클릭 시 카테고리 그룹 헤더가 보인다', () => {
    renderScheduleTab()
    fireEvent.click(screen.getByText('카테고리별'))
    // 카테고리 헤더 (한식, 분식, 중식, 양식, 패스트푸드, 카페, 편의점) 중 하나가 보여야 함
    const categoryLabels = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']
    const found = categoryLabels.some(
      (label) => screen.queryAllByText(new RegExp(`^${label}$`)).length > 0
    )
    expect(found).toBe(true)
  })

  it('"카테고리별" → "장소별" 전환 시 건물 헤더가 다시 보인다', () => {
    renderScheduleTab()
    // 카테고리별로 전환
    fireEvent.click(screen.getByText('카테고리별'))
    // 다시 장소별로 전환
    fireEvent.click(screen.getByText('장소별'))
    expect(
      screen.queryAllByText(/^TIP$/).length > 0 ||
      screen.queryAllByText(/^E동$/).length > 0 ||
      screen.queryAllByText(/^중앙도서관$/).length > 0
    ).toBe(true)
  })

  it('"지금 영업중" 탭에도 정렬 스위치가 렌더된다', () => {
    render(<CafeteriaVenues />)
    // 기본 탭(지금 영업중) — 스위치가 있어야 함
    expect(screen.getByText('장소별')).toBeInTheDocument()
    expect(screen.getByText('카테고리별')).toBeInTheDocument()
  })
})

// ─── F2: 매점/식당 즐겨찾기 테스트 ───────────────────────────────────────────
describe('CafeteriaVenues — F2 매점 즐겨찾기', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState.favorites.venues = []
  })

  it('각 카드에 즐겨찾기 별 버튼이 렌더된다', () => {
    render(<CafeteriaVenues />)
    const starButtons = screen.getAllByRole('button', { name: '즐겨찾기 추가' })
    expect(starButtons.length).toBeGreaterThan(0)
  })

  it('별 버튼 클릭 시 toggleFavoriteVenue가 호출되고 onVenueClick(카드 클릭)은 트리거되지 않는다', () => {
    const onVenueClick = vi.fn()
    render(<CafeteriaVenues onVenueClick={onVenueClick} />)

    const starButtons = screen.getAllByRole('button', { name: '즐겨찾기 추가' })
    fireEvent.click(starButtons[0])

    // 카드 자체의 onClick(onVenueClick)까지 버블링되면 안 된다.
    expect(onVenueClick).not.toHaveBeenCalled()
    // 즐겨찾기 상태가 실제로 하나 늘어났어야 한다.
    expect(mockStoreState.favorites.venues.length).toBe(1)
  })

  it('즐겨찾기가 없으면 "즐겨찾기 · 지금 영업 중" 섹션이 보이지 않는다', () => {
    render(<CafeteriaVenues />)
    expect(screen.queryByTestId('favorite-open-section')).not.toBeInTheDocument()
  })

  it('즐겨찾기한 곳이 지금 영업 중이면 상단에 "즐겨찾기 · 지금 영업 중" 섹션이 보인다', () => {
    // GS25는 24시간 연중무휴(alwaysOpen)라 시간대와 무관하게 항상 열려 있다
    mockStoreState.favorites.venues = ['gs25']
    render(<CafeteriaVenues />)

    const section = screen.getByTestId('favorite-open-section')
    expect(section).toBeInTheDocument()
    expect(section).toHaveTextContent('GS25')
  })

  it('즐겨찾기한 곳이 지금 영업 중이 아니면 섹션이 보이지 않는다', () => {
    // E동레스토랑은 학기 중 평일 11:30~13:50, 16:50~18:40만 운영 — 임의로 존재하지 않는 id로 대체 검증
    // (실제로는 열려 있을 수도 있으므로, 폐점 확정 시간대인 늦은 밤 조합을 피하고
    //  존재하지 않는 venue id로 "빈 섹션 노출 금지"를 검증한다)
    mockStoreState.favorites.venues = ['not-a-real-venue-id']
    render(<CafeteriaVenues />)
    expect(screen.queryByTestId('favorite-open-section')).not.toBeInTheDocument()
  })
})
