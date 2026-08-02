import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useAcademicCalendar: vi.fn(),
}))
vi.mock('../../hooks/useCafeteria', () => ({
  useCafeteriaMenu: vi.fn(),
}))

import { useAcademicCalendar } from '../../hooks/useMore'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import HomeBriefing from './HomeBriefing'
import { summarizeTodayMenu } from '../../utils/homeBriefing'

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
})
