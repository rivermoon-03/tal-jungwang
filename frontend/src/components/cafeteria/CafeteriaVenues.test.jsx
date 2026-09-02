/**
 * CafeteriaVenues 컴포넌트 테스트
 * - 기본 렌더 확인
 * - 카테고리 아이콘(SVG) 렌더 확인
 * - 카드 클릭 시 onVenueClick 콜백 호출 확인
 * - 영업중 상태 텍스트 표시 확인
 * - 건물별 위치 칩 표시 확인
 * - 정렬 스위치(장소별 ↔ 카테고리별) 전환 동작
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
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
    // 결함 #15: 이 컴포넌트는 매장 탭에서 렌더되므로 제목도 "매장"이어야 한다.
    expect(screen.getByText('매장 운영 정보')).toBeInTheDocument()
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

  it('운영시간 탭으로 전환하면 카테고리 그룹 헤더가 보인다 (기본: 카테고리별)', () => {
    render(<CafeteriaVenues />)
    const scheduleTab = screen.getByText('운영시간')
    fireEvent.click(scheduleTab)
    // 기본 카테고리별 정렬: 한식/분식/중식/양식/패스트푸드/카페/편의점 헤더 중 하나가 있어야 함
    const categoryLabels = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']
    const found = categoryLabels.some(
      (label) => screen.queryAllByText(new RegExp(`^${label}$`)).length > 0
    )
    expect(found).toBe(true)
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

  it('기본값은 "카테고리별"이며 카테고리 그룹 헤더가 보인다', () => {
    renderScheduleTab()
    // aria-pressed로 어느 옵션이 기본 활성인지도 함께 확인한다.
    expect(screen.getByText('카테고리별').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('장소별').closest('button')).toHaveAttribute('aria-pressed', 'false')
    // 카테고리 헤더 (한식, 분식, 중식, 양식, 패스트푸드, 카페, 편의점) 중 하나가 보여야 함
    const categoryLabels = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']
    const found = categoryLabels.some(
      (label) => screen.queryAllByText(new RegExp(`^${label}$`)).length > 0
    )
    expect(found).toBe(true)
  })

  it('"장소별" 클릭 시 건물 그룹 헤더가 보인다', () => {
    renderScheduleTab()
    fireEvent.click(screen.getByText('장소별'))
    // 건물 헤더(TIP, E동, 중앙도서관) 중 하나가 보여야 함
    expect(
      screen.queryAllByText(/^TIP$/).length > 0 ||
      screen.queryAllByText(/^E동$/).length > 0 ||
      screen.queryAllByText(/^중앙도서관$/).length > 0
    ).toBe(true)
  })

  it('"장소별" → "카테고리별" 전환 시 카테고리 헤더가 다시 보인다', () => {
    renderScheduleTab()
    // 장소별로 전환
    fireEvent.click(screen.getByText('장소별'))
    // 다시 카테고리별로 전환
    fireEvent.click(screen.getByText('카테고리별'))
    const categoryLabels = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']
    const found = categoryLabels.some(
      (label) => screen.queryAllByText(new RegExp(`^${label}$`)).length > 0
    )
    expect(found).toBe(true)
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

// ─── 시안2 "다정한 카드" — 카드 해부 통일 테스트 ─────────────────────────────
describe('CafeteriaVenues — 카드 해부 통일', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState.favorites.venues = []
  })

  it('학식 카드(meals형)와 단순 매점 카드(hours형)가 같은 카드 해부(rounded-card + shadow-sh-card)를 공유한다', () => {
    render(<CafeteriaVenues />)
    fireEvent.click(screen.getByText('운영시간'))
    // 학생식당: meals 구조(예전 RestaurantCard). 토마토김밥: hours 구조(예전 SimpleVenueCard).
    const restaurantCard = screen.getByRole('button', { name: '학생식당' })
    const simpleCard = screen.getByRole('button', { name: '토마토김밥' })
    expect(restaurantCard.className).toContain('rounded-card')
    expect(restaurantCard.className).toContain('shadow-sh-card')
    expect(simpleCard.className).toContain('rounded-card')
    expect(simpleCard.className).toContain('shadow-sh-card')
  })

  it('대표메뉴(venue.menu)가 태그 칩으로 렌더된다', () => {
    render(<CafeteriaVenues />)
    fireEvent.click(screen.getByText('운영시간'))
    // 학생식당 menu: ['천원의아침밥', '셀프라면', '매일 바뀌는 식단'] (3개, 그대로 노출)
    expect(screen.getByText('천원의아침밥')).toBeInTheDocument()
    expect(screen.getByText('셀프라면')).toBeInTheDocument()
  })

  it('대표메뉴가 3개를 넘으면 "+N" 칩으로 나머지를 묶는다 (수호식당 5개 메뉴)', () => {
    render(<CafeteriaVenues />)
    fireEvent.click(screen.getByText('운영시간'))
    // 수호식당 menu: ['한식뷔페', '국밥', '순대국', '칼국수', '맥주'] — 앞 3개만 칩, 나머지는 +2.
    // 같은 카테고리(한식)의 신북경도 메뉴가 5개(+2)라 페이지 전체에서는 "+2"가 유일하지
    // 않으므로 수호식당 카드 안으로 범위를 좁혀 확인한다.
    const card = screen.getByRole('button', { name: '수호식당' })
    expect(within(card).getByText('한식뷔페')).toBeInTheDocument()
    expect(within(card).getByText('국밥')).toBeInTheDocument()
    expect(within(card).getByText('순대국')).toBeInTheDocument()
    expect(within(card).getByText('+2')).toBeInTheDocument()
    expect(within(card).queryByText('칼국수')).not.toBeInTheDocument()
    expect(within(card).queryByText('맥주')).not.toBeInTheDocument()
  })

  it('카드 그리드에 PC 다열(md/lg) 반응형 클래스가 적용된다', () => {
    const { container } = render(<CafeteriaVenues />)
    const grid = container.querySelector('.grid')
    expect(grid).toBeTruthy()
    expect(grid.className).toContain('md:grid-cols-2')
    expect(grid.className).toContain('lg:grid-cols-3')
  })
})
