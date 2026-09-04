/**
 * FacilitiesPage(학교시설) 테스트
 * 백엔드 형식: { week_start, year, fetched_at, cafeterias: [{ name, meals: [{ type, time, by_day }] }] }
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useCafeteriaMenu 훅 모킹
vi.mock('../hooks/useCafeteria', () => ({
  useCafeteriaMenu: vi.fn(),
}))

// PageHeader 모킹
vi.mock('../components/layout/PageHeader', () => ({
  default: ({ title }) => <header data-testid="page-header">{title}</header>,
}))

// cafeteriaDays 모킹 (isKstWeekend만 제어 가능하게)
vi.mock('../utils/cafeteriaDays', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    isKstWeekend: vi.fn(() => false), // 기본값: 평일
  }
})

// CafeteriaVenues 모킹
vi.mock('../components/cafeteria/CafeteriaVenues', () => ({
  default: () => <div data-testid="cafeteria-venues">운영정보 컴포넌트</div>,
}))

import { useCafeteriaMenu } from '../hooks/useCafeteria'
import { isKstWeekend } from '../utils/cafeteriaDays'
import FacilitiesPage from './FacilitiesPage'

const MOCK_DATA = {
  week_start: '5.11',
  year: 2026,
  fetched_at: '2026-05-13T10:30:00+09:00',
  cafeterias: [
    {
      name: 'TIP 학생식당',
      meals: [
        {
          type: '중식',
          time: '11:00~14:00',
          by_day: {
            '11': ['제육볶음면', '계란국', '깍두기'],
            '12': ['돼지불고기', '미역국'],
            '13': ['비빔밥', '된장찌개', '김치'],
            '14': ['치킨까스', '콩나물국'],
            '15': [],
          },
        },
        {
          type: '석식',
          time: '17:00~19:00',
          by_day: {
            '11': ['미운영'],
            '12': ['돈까스', '북어국'],
            '13': ['삼겹살', '순두부찌개'],
            '14': [],
            '15': [],
          },
        },
        {
          type: '천원의 아침밥',
          time: '08:00~09:00',
          by_day: {
            '11': ['토스트', '우유'],
            '12': ['샌드위치'],
            '13': ['핫도그'],
            '14': ['크로아상'],
            '15': [],
          },
        },
      ],
    },
    {
      name: 'E동 레스토랑',
      meals: [
        {
          type: '중식',
          time: '11:30~13:30',
          by_day: {
            '11': ['파스타', '샐러드'],
            '12': ['스테이크', '수프'],
            '13': ['리조또'],
            '14': ['피자'],
            '15': [],
          },
        },
      ],
    },
  ],
}

describe('FacilitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 오늘을 2026-05-13(수요일)로 고정
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T10:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- 헤더 ---
  it('페이지 헤더에 "학교시설"을 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    expect(screen.getByTestId('page-header')).toHaveTextContent('학교시설')
  })

  it('fetched_at 기반으로 갱신 시각을 표시한다(학식 탭)', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 매장이라 갱신 시각은 아직 없다 — 식단표를 언제 받아왔는지는
    // 학식 탭에서만 뜻이 있다(매장 탭의 "지금 HH:MM" 실시간 시계와 헷갈리던 자리).
    expect(screen.queryByText(/갱신/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText(/갱신/)).toBeInTheDocument()
    expect(screen.getByText(/10:30/)).toBeInTheDocument()
  })

  it('매장 탭에서는 갱신 시각을 보여주지 않는다(결함: "이 시각" 기준 시각 혼동)', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 매장이므로 별도 클릭 없이 바로 확인한다.
    expect(screen.queryByText(/갱신/)).not.toBeInTheDocument()
  })

  // --- 결함 #7: 헤더와 탭까지 포함한 통짜 스크롤 ---
  // 예전엔 헤더, 메인 탭, 식당 칩, 요일 칩이 스크롤 컨테이너 밖에 있어서
  // 그 위에서 쓸어도 화면이 안 움직였다. 스크롤러를 하나로 합치고, 그 스크롤러
  // 안에 헤더와 탭이 실제로 들어가는지, 그리고 스크롤러가 중첩되지 않는지(과거
  // 대시보드 회귀 재발 방지) 구조로 고정한다.
  it('결함 #7: 스크롤 컨테이너가 하나뿐이고 헤더와 메인 탭을 포함한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    const { container } = render(<FacilitiesPage />)
    const scrollers = container.querySelectorAll('.overflow-y-auto')
    expect(scrollers).toHaveLength(1)
    const scroller = scrollers[0]
    expect(scroller.contains(screen.getByTestId('page-header'))).toBe(true)
    expect(scroller.contains(screen.getByRole('tab', { name: '학식' }))).toBe(true)
    expect(scroller.contains(screen.getByRole('tab', { name: '매장' }))).toBe(true)
  })

  it('결함 #7: 학식 탭에서는 식당 칩과 요일 칩 히어로도 같은 스크롤 컨테이너 안에 있다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    const { container } = render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    const scrollers = container.querySelectorAll('.overflow-y-auto')
    expect(scrollers).toHaveLength(1)
    const scroller = scrollers[0]
    expect(scroller.contains(screen.getByRole('tab', { name: 'TIP 학생식당' }))).toBe(true)
    expect(scroller.contains(screen.getByText('오늘 뭐 먹지'))).toBe(true)
  })

  // --- 식당 세그먼트 탭 (식단 탭 전환 후 확인) ---
  it('cafeterias 이름을 세그먼트 탭으로 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByRole('tab', { name: 'TIP 학생식당' })).toBeInTheDocument()
    // "E동 레스토랑"은 세그먼트 탭과 다른 식당 미리보기 섹션 제목에 중복으로
    // 나타날 수 있어(기본 선택이 TIP이므로 미리보기는 E동), role로 세그먼트
    // 탭만 특정한다.
    expect(screen.getByRole('tab', { name: 'E동 레스토랑' })).toBeInTheDocument()
  })

  // --- 요일 칩 ---
  it('by_day 키를 요일 라벨 칩으로 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 11일(월)~15일(금)
    expect(screen.getByText(/11일/)).toBeInTheDocument()
    expect(screen.getByText(/12일/)).toBeInTheDocument()
    expect(screen.getByText(/13일/)).toBeInTheDocument()
  })

  it('오늘(13일)이 자동 선택된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 오늘(13일) 칩이 aria-pressed=true
    const todayChip = screen.getByText(/13일/)
    expect(todayChip.closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  // --- meal type 섹션 ---
  it('선택된 날의 meal type 섹션(중식/석식/천원의아침밥)을 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 시안대로 다른 식당 미리보기가 아래에 붙으면서 끼니 이름이 두 번 나온다.
    // 선택된 식당의 끼니 카드 제목만 보면 되므로 getAllByText 로 존재만 확인한다.
    expect(screen.getAllByText('중식').length).toBeGreaterThan(0)
    expect(screen.getAllByText('석식').length).toBeGreaterThan(0)
    expect(screen.getByText('천원의 아침밥')).toBeInTheDocument()
  })

  it('meal time을 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText('11:00~14:00')).toBeInTheDocument()
  })

  it('선택된 날(13일)의 메뉴를 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText('비빔밥')).toBeInTheDocument()
    expect(screen.getByText('된장찌개')).toBeInTheDocument()
    expect(screen.getByText('김치')).toBeInTheDocument()
  })

  it('다른 날 칩 클릭 시 해당 날 메뉴로 변경된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 11일 클릭
    const chip11 = screen.getByText(/11일/).closest('button')
    fireEvent.click(chip11)
    expect(screen.getByText('제육볶음면')).toBeInTheDocument()
  })

  // --- 빈 메뉴 / 미운영 ---
  it('by_day 값이 [] 또는 ["미운영"]이면 EmptyState를 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 13일 석식은 ['삼겹살', '순두부찌개']이니 11일로 바꿔서 미운영 확인
    const chip11 = screen.getByText(/11일/).closest('button')
    fireEvent.click(chip11)
    // 11일 석식은 ['미운영'] → 오늘은 운영하지 않아요 텍스트
    expect(screen.getByText(/운영하지 않아요/)).toBeInTheDocument()
  })

  // --- 식당 탭 전환 ---
  it('E동 레스토랑 탭 클릭 시 해당 식당 메뉴를 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    fireEvent.click(screen.getByRole('tab', { name: 'E동 레스토랑' }))
    expect(screen.getByText('리조또')).toBeInTheDocument()
  })

  // --- NO_MENU 주말 분기 ---
  it('NO_MENU 에러 + 주말이면 식단 탭에서 "주말에는 학식을 운영하지 않아요"를 렌더한다', () => {
    isKstWeekend.mockReturnValue(true)
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    useCafeteriaMenu.mockReturnValue({
      data: null,
      loading: false,
      error: err,
      refetch: vi.fn(),
    })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText(/주말에는 학식을 운영하지 않아요/)).toBeInTheDocument()
    expect(screen.getByText(/평일에 다시 확인해 주세요/)).toBeInTheDocument()
  })

  it('NO_MENU 에러 + 주말이면 재시도 버튼이 없다', () => {
    isKstWeekend.mockReturnValue(true)
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    useCafeteriaMenu.mockReturnValue({
      data: null,
      loading: false,
      error: err,
      refetch: vi.fn(),
    })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  // --- NO_MENU 평일 분기 ---
  it('NO_MENU 에러 + 평일이면 식단 탭에서 "등록된 식단이 없어요"를 렌더한다', () => {
    isKstWeekend.mockReturnValue(false)
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    useCafeteriaMenu.mockReturnValue({
      data: null,
      loading: false,
      error: err,
      refetch: vi.fn(),
    })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText(/등록된 식단이 없어요/)).toBeInTheDocument()
    expect(screen.getByText(/방학 기간/)).toBeInTheDocument()
  })

  it('NO_MENU 에러 + 평일이면 "다시 확인" 버튼이 있고 클릭 시 refetch를 호출한다', () => {
    isKstWeekend.mockReturnValue(false)
    const refetch = vi.fn()
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    useCafeteriaMenu.mockReturnValue({
      data: null,
      loading: false,
      error: err,
      refetch,
    })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    const retryBtn = screen.getByRole('button', { name: '다시 확인' })
    fireEvent.click(retryBtn)
    expect(refetch).toHaveBeenCalledOnce()
  })

  // --- 에러 상태 ---
  it('에러 시 ErrorState를 렌더하고 헤더는 유지한다', () => {
    isKstWeekend.mockReturnValue(false)
    useCafeteriaMenu.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('network error'),
      refetch: vi.fn(),
    })
    render(<FacilitiesPage />)
    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 에러 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument()
  })

  it('에러 시 다시 시도 버튼을 렌더하고 클릭하면 refetch를 호출한다', () => {
    isKstWeekend.mockReturnValue(false)
    const refetch = vi.fn()
    useCafeteriaMenu.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('network error'),
      refetch,
    })
    render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 에러 버튼 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    const retryBtn = screen.getByRole('button', { name: '다시 시도' })
    fireEvent.click(retryBtn)
    expect(refetch).toHaveBeenCalledOnce()
  })

  // --- 로딩 상태 ---
  it('로딩 중 식단 탭으로 전환하면 스켈레톤을 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 스켈레톤 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // --- AI티 / 소글자 사용 금지 ---
  it('9px 이하 font-size 인라인 스타일을 쓰지 않는다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    const { container } = render(<FacilitiesPage />)
    const allEls = container.querySelectorAll('[style]')
    allEls.forEach((el) => {
      const fs = el.style.fontSize
      if (fs && fs.endsWith('px')) {
        expect(Number(fs.replace('px', ''))).toBeGreaterThanOrEqual(12)
      }
    })
  })

  // --- 메인 탭: 학식 / 매장 / 도서관 ---
  it('상단에 [학식] [매장] [도서관] 메인 탭이 렌더된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    expect(screen.getByRole('tab', { name: '학식' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '매장' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '도서관' })).toBeInTheDocument()
  })

  it('기본 탭은 [매장]이고 CafeteriaVenues가 보인다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    const venuesTab = screen.getByRole('tab', { name: '매장' })
    expect(venuesTab).toHaveAttribute('aria-selected', 'true')
    // 매장 탭이 활성이므로 CafeteriaVenues 컴포넌트가 보여야 한다
    expect(screen.getByTestId('cafeteria-venues')).toBeInTheDocument()
  })

  it('기본 탭이 [매장]이므로 초기에는 식단 메뉴가 보이지 않는다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본이 매장이므로 식단 메뉴는 보이지 않는다
    expect(screen.queryByText('비빔밥')).not.toBeInTheDocument()
    expect(screen.queryByText('중식')).not.toBeInTheDocument()
  })

  it('[매장] 탭은 기본 활성 상태이므로 CafeteriaVenues가 바로 렌더된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    expect(screen.getByTestId('cafeteria-venues')).toBeInTheDocument()
  })

  it('[식단] 탭 클릭 시 식단 메뉴가 렌더된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 식단 탭 콘텐츠(메뉴)가 보인다
    expect(screen.getByText('비빔밥')).toBeInTheDocument()
  })

  it('[식단] 탭 클릭 시 CafeteriaVenues가 사라진다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.queryByTestId('cafeteria-venues')).not.toBeInTheDocument()
  })

  it('[식단] 탭에서 [운영정보] 탭 복귀 시 CafeteriaVenues가 다시 보인다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    fireEvent.click(screen.getByRole('tab', { name: '매장' }))
    expect(screen.getByTestId('cafeteria-venues')).toBeInTheDocument()
  })

  it('NO_MENU 에러는 식단 탭으로 전환 시 렌더된다 (기본은 운영정보 탭)', () => {
    isKstWeekend.mockReturnValue(false)
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    useCafeteriaMenu.mockReturnValue({ data: null, loading: false, error: err, refetch: vi.fn() })
    render(<FacilitiesPage />)
    // 기본 탭이 운영정보이므로 먼저 식단 탭으로 전환
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 식단 탭으로 전환하면 NO_MENU 빈상태가 보인다
    expect(screen.getByText(/등록된 식단이 없어요/)).toBeInTheDocument()
    // 운영정보 탭은 여전히 보인다
    expect(screen.getByRole('tab', { name: '매장' })).toBeInTheDocument()
  })

  // --- 시안: 메뉴는 격자 타일이 아니라 태그 칩 레일이다 ---
  it('식단 탭으로 전환하면 메뉴 아이템이 태그 칩 레일로 렌더된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    const { container } = render(<FacilitiesPage />)
    // 기본 탭이 venues이므로 식단 탭으로 전환 후 확인
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 메뉴 태그 레일 컨테이너 존재 확인 (data-testid) — 예전 격자(menu-grid)는
    // 앞 두 항목을 임의로 강조하는 문제가 있어 태그 칩(menu-tags)으로 바뀌었다.
    const tagsRail = container.querySelector('[data-testid="menu-tags"]')
    expect(tagsRail).toBeInTheDocument()
    expect(screen.getByText('비빔밥')).toHaveClass('rounded-pill')
  })

  // --- 시안: 히어로 "오늘 뭐 먹지" + 캡션 ---
  it('식단 탭으로 전환하면 히어로 헤드라인과 요일 칩 캡션이 보인다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    expect(screen.getByText('오늘 뭐 먹지')).toBeInTheDocument()
    expect(screen.getByText('점은 오늘 · 채움은 선택')).toBeInTheDocument()
  })

  // --- 시안: 다른 식당 미리보기(전체 보기) ---
  it('선택되지 않은 식당의 미리보기 섹션과 "전체 보기" 버튼을 렌더한다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    // 기본 선택은 TIP 학생식당이므로 미리보기는 E동 레스토랑이다.
    expect(screen.getByRole('heading', { name: 'E동 레스토랑' })).toBeInTheDocument()
    expect(screen.getByText('리조또')).toBeInTheDocument()
  })

  it('다른 식당 미리보기의 "전체 보기"를 클릭하면 해당 식당으로 전환된다', () => {
    useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
    render(<FacilitiesPage />)
    fireEvent.click(screen.getByRole('tab', { name: '학식' }))
    fireEvent.click(screen.getAllByRole('button', { name: '전체 보기' })[0])
    // 이제 E동 레스토랑이 메인 선택이 되어 세그먼트 탭이 활성 표시된다.
    // 식당명은 세그먼트 탭과 미리보기 제목 양쪽에 나오므로 tab 역할로 좁힌다.
    const eDongTab = screen.getByRole('tab', { name: /E동 레스토랑/ })
    expect(eDongTab).toHaveAttribute('aria-selected', 'true')
  })

  // --- 부분 데이터 시나리오 (방학 중 일부 요일만 식단 있는 경우) ---
  describe('부분 데이터 — 일부 요일만 메뉴 있는 경우', () => {
    // 월(23)·화(24)만 메뉴 있고 수~금(25~27)은 빈 배열
    // 오늘을 수요일(25일)로 고정 → 메뉴 없는 날
    const PARTIAL_DATA = {
      week_start: '6.23',
      year: 2026,
      fetched_at: '2026-06-25T08:00:00+09:00',
      cafeterias: [
        {
          name: 'TIP 학생식당',
          meals: [
            {
              type: '중식',
              time: '11:00~14:00',
              by_day: {
                '23': ['제육볶음', '미역국'],
                '24': ['돼지불고기', '콩나물국'],
                '25': [],
                '26': [],
                '27': [],
              },
            },
            {
              type: '석식',
              time: '17:00~19:00',
              by_day: {
                '23': ['돈까스', '북어국'],
                '24': ['삼겹살', '된장찌개'],
                '25': [],
                '26': [],
                '27': [],
              },
            },
          ],
        },
      ],
    }

    beforeEach(() => {
      // 오늘을 2026-06-25(목요일 아님, 실제 달력: 수요일)로 고정
      vi.setSystemTime(new Date('2026-06-25T10:00:00+09:00'))
    })

    it('일부 요일만 메뉴 있어도 전체 빈 상태로 빠지지 않는다', () => {
      useCafeteriaMenu.mockReturnValue({ data: PARTIAL_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      // 기본 탭이 venues이므로 식단 탭으로 전환
      fireEvent.click(screen.getByRole('tab', { name: '학식' }))
      // 전체 빈 상태(방학/등록 없음)가 아니어야 함
      expect(screen.queryByText(/지금은 등록된 식단이 없어요/)).not.toBeInTheDocument()
      expect(screen.queryByText(/현재 등록된 식단이 없어요/)).not.toBeInTheDocument()
    })

    it('오늘(25일)이 메뉴 없는 날이면 메뉴 있는 가장 가까운 날(24일)을 자동 선택한다', () => {
      useCafeteriaMenu.mockReturnValue({ data: PARTIAL_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      // 기본 탭이 venues이므로 식단 탭으로 전환
      fireEvent.click(screen.getByRole('tab', { name: '학식' }))
      // 24일 칩이 활성 선택되어야 함
      const chip24 = screen.getByText(/24일/).closest('button')
      expect(chip24).toHaveAttribute('aria-pressed', 'true')
      // 24일 메뉴가 표시되어야 함
      expect(screen.getByText('돼지불고기')).toBeInTheDocument()
    })

    it('메뉴 있는 날(23, 24일) 칩은 정상 표시되고 없는 날(25~27일)은 흐리게 표시된다', () => {
      useCafeteriaMenu.mockReturnValue({ data: PARTIAL_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      // 기본 탭이 venues이므로 식단 탭으로 전환
      fireEvent.click(screen.getByRole('tab', { name: '학식' }))
      // 메뉴 있는 날: data-has-menu="true"
      const chip23 = screen.getByText(/23일/).closest('button')
      const chip24 = screen.getByText(/24일/).closest('button')
      expect(chip23).toHaveAttribute('data-has-menu', 'true')
      expect(chip24).toHaveAttribute('data-has-menu', 'true')
      // 메뉴 없는 날: data-has-menu="false"
      const chip25 = screen.getByText(/25일/).closest('button')
      expect(chip25).toHaveAttribute('data-has-menu', 'false')
    })

    it('메뉴 없는 날(25일) 칩 클릭 시 해당 날이 선택되고 미운영 안내가 보인다', () => {
      useCafeteriaMenu.mockReturnValue({ data: PARTIAL_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      // 기본 탭이 venues이므로 식단 탭으로 전환
      fireEvent.click(screen.getByRole('tab', { name: '학식' }))
      const chip25 = screen.getByText(/25일/).closest('button')
      fireEvent.click(chip25)
      expect(chip25).toHaveAttribute('aria-pressed', 'true')
      // 모든 끼니가 미운영이므로 "운영하지 않아요" 텍스트가 보인다
      expect(screen.getAllByText(/운영하지 않아요/).length).toBeGreaterThan(0)
    })

    it('메뉴 있는 날(23일) 칩 클릭 시 해당 날 메뉴가 보인다', () => {
      useCafeteriaMenu.mockReturnValue({ data: PARTIAL_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      // 기본 탭이 venues이므로 식단 탭으로 전환
      fireEvent.click(screen.getByRole('tab', { name: '학식' }))
      const chip23 = screen.getByText(/23일/).closest('button')
      fireEvent.click(chip23)
      expect(screen.getByText('제육볶음')).toBeInTheDocument()
    })

    it('모든 날짜·모든 끼니가 빈 배열일 때만 EmptyState를 렌더한다', () => {
      const allEmptyData = {
        week_start: '6.23',
        year: 2026,
        fetched_at: '2026-06-25T08:00:00+09:00',
        cafeterias: [
          {
            name: 'TIP 학생식당',
            meals: [
              {
                type: '중식',
                time: '11:00~14:00',
                by_day: { '23': [], '24': [], '25': [] },
              },
            ],
          },
        ],
      }
      useCafeteriaMenu.mockReturnValue({ data: allEmptyData, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      // 기본 탭이 venues이므로 식단 탭으로 전환
      fireEvent.click(screen.getByRole('tab', { name: '학식' }))
      // 요일 칩은 보이되 각 날의 끼니 섹션에 "운영하지 않아요"가 보인다
      // (전체 데이터 없음 EmptyState가 아님 — cafeteria.meals가 존재하므로)
      expect(screen.queryByText(/현재 등록된 식단이 없어요/)).not.toBeInTheDocument()
      // 미운영 안내는 보인다
      expect(screen.getByText(/운영하지 않아요/)).toBeInTheDocument()
    })
  })

  // 하단 독의 "학식"과 "매장"은 같은 /facilities 를 ?tab= 로 구분해 연다.
  // 쿼리를 안 읽으면 학식을 눌러도 매장 탭이 떴다.
  describe('?tab= 쿼리로 초기 탭 결정', () => {
    const setSearch = (qs) => window.history.replaceState({}, '', `/facilities${qs}`)

    afterEach(() => setSearch(''))

    it('?tab=diet 이면 학식 탭으로 열린다', () => {
      setSearch('?tab=diet')
      useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      expect(screen.getByRole('tab', { name: '학식' })).toHaveAttribute('aria-selected', 'true')
    })

    it('?tab=venues 이면 매장 탭으로 열린다', () => {
      setSearch('?tab=venues')
      useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      expect(screen.getByRole('tab', { name: '매장' })).toHaveAttribute('aria-selected', 'true')
    })

    it('쿼리가 없거나 모르는 값이면 매장 탭이다', () => {
      setSearch('?tab=zzz')
      useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      expect(screen.getByRole('tab', { name: '매장' })).toHaveAttribute('aria-selected', 'true')
    })

    it('같은 경로에서 주소만 바뀌어도(popstate) 탭이 따라온다', () => {
      setSearch('?tab=venues')
      useCafeteriaMenu.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, refetch: vi.fn() })
      render(<FacilitiesPage />)
      setSearch('?tab=diet')
      fireEvent(window, new PopStateEvent('popstate'))
      expect(screen.getByRole('tab', { name: '학식' })).toHaveAttribute('aria-selected', 'true')
    })
  })
})
