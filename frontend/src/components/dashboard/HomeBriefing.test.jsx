import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useAcademicCalendar: vi.fn(),
  useLibraryHours: vi.fn(() => ({ data: null, loading: false, error: null })),
}))
vi.mock('../../hooks/useCafeteria', () => ({
  useCafeteriaMenu: vi.fn(),
}))

import { useAcademicCalendar } from '../../hooks/useMore'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import HomeBriefing from './HomeBriefing'
import { summarizeTodayMenu, summarizeLibraryHours } from '../../utils/homeBriefing'

const CALENDAR = {
  next: { title: '26학년도 2학기 수강신청', start_date: '2026-08-04', end_date: '2026-08-06' },
  upcoming: [],
}

// 오늘(가짜 시각) 8/3(월)이 포함된 주차 식단
const MENU = {
  week_start: '8.3',
  year: 2026,
  cafeterias: [
    {
      name: 'TIP 학생식당',
      meals: [
        { type: '조식', time: '9:00~10:00', by_day: { 3: ['셀프라면'] } },
        { type: '중식', time: '11:00~14:00', by_day: { 3: ['고기국수', '타코야끼', '락교'] } },
      ],
    },
  ],
}

describe('HomeBriefing (F1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T09:00:00+09:00')) // 월요일
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('학사일정 D-day와 오늘 학식을 렌더한다', () => {
    useAcademicCalendar.mockReturnValue({ data: CALENDAR, loading: false, error: null })
    useCafeteriaMenu.mockReturnValue({ data: MENU, loading: false, error: null })
    render(<HomeBriefing />)
    expect(screen.getByText('학사일정 D-1')).toBeInTheDocument()
    expect(screen.getByText('26학년도 2학기 수강신청')).toBeInTheDocument()
    expect(screen.getByText('중식 · 고기국수 외 2')).toBeInTheDocument()
  })

  it('보여줄 데이터가 없으면 섹션 자체를 그리지 않는다', () => {
    useAcademicCalendar.mockReturnValue({ data: null, loading: false, error: null })
    useCafeteriaMenu.mockReturnValue({ data: null, loading: false, error: null })
    const { container } = render(<HomeBriefing />)
    expect(container.firstChild).toBeNull()
  })

  it('지난주(스테일) 식단은 오늘 학식으로 요약하지 않는다', () => {
    const stale = { ...MENU, week_start: '7.27', cafeterias: [{
      ...MENU.cafeterias[0],
      meals: [{ type: '중식', time: '', by_day: { 27: ['고기국수'] } }],
    }] }
    expect(summarizeTodayMenu(stale)).toBe(null)
  })

  it('오늘 키가 없으면(주말 등) 학식 요약은 null', () => {
    vi.setSystemTime(new Date('2026-08-09T09:00:00+09:00')) // 다음 일요일
    expect(summarizeTodayMenu(MENU)).toBe(null)
  })

  // 결함 #9 — 학교 원본(xlsx)의 별표 메타 표기("*복수메뉴*")가 메뉴 이름인 척
  // 브리핑 한 줄에 그대로 찍혔다. 실측: 중식 by_day가
  // ["*복수메뉴*", "에비동/제육볶음면", "무채국", "비엔나구이", "치커리사과무침", "깍두기"].
  it('별표 메타 표기(*복수메뉴* 등)는 학식 요약에서 걷어낸다', () => {
    const withMeta = {
      ...MENU,
      cafeterias: [{
        ...MENU.cafeterias[0],
        meals: [{
          type: '중식',
          time: '11:00~14:00',
          by_day: { 3: ['*복수메뉴*', '에비동/제육볶음면', '무채국', '비엔나구이', '치커리사과무침', '깍두기'] },
        }],
      }],
    }
    expect(summarizeTodayMenu(withMeta)).toBe('중식 · 에비동/제육볶음면 외 4')
  })

  it('시험 D-7 이내면 시험기간 카드 + 도서관 개관시간이 뜬다(F7)', async () => {
    const { useLibraryHours } = await import('../../hooks/useMore')
    useLibraryHours.mockReturnValue({
      data: [
        { room: '자료열람실(3층)', period: '학기', hours: '평일 09:00 ~ 22:00', closed: false },
      ],
      loading: false,
      error: null,
    })
    useAcademicCalendar.mockReturnValue({
      data: { next: { title: '2학기 기말고사', start_date: '2026-08-06', end_date: '2026-08-12' }, upcoming: [] },
      loading: false,
      error: null,
    })
    useCafeteriaMenu.mockReturnValue({ data: null, loading: false, error: null })
    render(<HomeBriefing />)
    expect(screen.getByText(/기말고사 D-3/)).toBeInTheDocument()
    expect(screen.getByText('자료열람실(3층)')).toBeInTheDocument()
    expect(screen.getByText('09:00 ~ 22:00')).toBeInTheDocument()
  })

  it('시험이 멀면 홈에서는 도서관 카드를 빼고 학교시설 탭에 맡긴다', async () => {
    const { useLibraryHours } = await import('../../hooks/useMore')
    useLibraryHours.mockReturnValue({
      data: [{ room: '자료열람실(3층)', period: '학기', hours: '평일 09:00 ~ 22:00', closed: false }],
      loading: false,
      error: null,
    })
    useAcademicCalendar.mockReturnValue({
      data: { next: { title: '2학기 기말고사', start_date: '2026-10-19', end_date: '2026-10-25' }, upcoming: [] },
      loading: false,
      error: null,
    })
    useCafeteriaMenu.mockReturnValue({ data: null, loading: false, error: null })
    render(<HomeBriefing />)
    expect(screen.queryByText(/기말고사 D-/)).not.toBeInTheDocument()
    // 평시의 "지금 도서관 열었나"는 학교시설 탭이 상시로 답한다. 홈은 교통 정보에
    // 화면을 내준다 — 예전에는 도착 카드 아래에 쌓여 스크롤 끝까지 가야 보였다.
    expect(screen.queryByLabelText('도서관 열람실 안내')).not.toBeInTheDocument()
  })

  it('열람실 데이터가 없으면 도서관 카드를 그리지 않는다', async () => {
    const { useLibraryHours } = await import('../../hooks/useMore')
    useLibraryHours.mockReturnValue({ data: [], loading: false, error: null })
    useAcademicCalendar.mockReturnValue({ data: CALENDAR, loading: false, error: null })
    useCafeteriaMenu.mockReturnValue({ data: null, loading: false, error: null })
    render(<HomeBriefing />)
    expect(screen.queryByLabelText('도서관 열람실 안내')).not.toBeInTheDocument()
  })
})

// 열람실 개관시간은 시험기간(F7) 카드에만 있어 방학·평시에는 보이지 않았다.
// "지금 도서관 열었나"는 상시 질문이라 브리핑 행으로 승격한 뒤의 요약 규칙.
describe('summarizeLibraryHours — 도서관 열람실 상시 요약', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const ROOMS = [
    { room: '노트북열람실', period: '방학', hours: '매일 06:30 ~ 23:00', closed: false },
    { room: '자료열람실(3층)', period: '방학', hours: '평일 09:30 ~ 17:30', closed: false },
    { room: '제1일반열람실', period: '방학', hours: '미개방', closed: true },
  ]

  it('평일 낮에는 열린 곳 수와 가장 늦게 닫는 곳을 알려준다', () => {
    vi.setSystemTime(new Date('2026-08-03T14:00:00+09:00')) // 월요일 14시
    const s = summarizeLibraryHours(ROOMS)
    expect(s.open).toBe(true)
    expect(s.label).toBe('지금 2곳 열림')
    expect(s.sub).toBe('노트북열람실 23:00까지')
  })

  it('평일 전용 열람실은 일요일에 제외된다', () => {
    vi.setSystemTime(new Date('2026-08-02T14:00:00+09:00')) // 일요일
    expect(summarizeLibraryHours(ROOMS).label).toBe('지금 1곳 열림')
  })

  it('개방 전 새벽에는 다음 개방 시각을 알려준다', () => {
    vi.setSystemTime(new Date('2026-08-03T05:00:00+09:00'))
    const s = summarizeLibraryHours(ROOMS)
    expect(s.open).toBe(false)
    expect(s.sub).toBe('노트북열람실 06:30 개방')
  })

  it('미개방만 있으면 오늘 미운영으로 안내한다', () => {
    vi.setSystemTime(new Date('2026-08-03T14:00:00+09:00'))
    const s = summarizeLibraryHours([{ room: '제1일반열람실', hours: '미개방', closed: true }])
    expect(s.open).toBe(false)
    expect(s.label).toBe('오늘은 열람실을 열지 않아요')
  })

  it('데이터가 없으면 행을 그리지 않는다(null)', () => {
    expect(summarizeLibraryHours([])).toBe(null)
    expect(summarizeLibraryHours(null)).toBe(null)
  })
})
