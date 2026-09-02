/**
 * AcademicNoticesPCContent — 더보기 PC "학사공지" 콘텐츠 단위 테스트.
 * 백엔드 API(/school/board-notices, /school/calendar)는 useMore 훅을 모킹해
 * 실제 네트워크 호출 없이 검증한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useSchoolBoardNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import AcademicNoticesPCContent from './AcademicNoticesPCContent'

const NOTICE = {
  id: 151703,
  category: 'academic',
  category_label: '학사',
  title: '2026학년도 2학기 수강신청 및 교과시간표 안내',
  url: 'https://www.tukorea.ac.kr/bbs/tukorea/107/151703/artclView.do',
  published_at: '2026-07-16T00:00:00+09:00',
}

// "진행 중인" 학사일정 — 오늘(9/3)보다 며칠 앞선 날짜에 시작해 오늘까지 이어진다.
// 결함 #3 재현: 이 시작일(9/1)이 캘린더 기본 선택으로 새어나가면 안 된다.
const CALENDAR = {
  next: { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-04' },
  upcoming: [{ title: '수강정정', start_date: '2026-09-07', end_date: '2026-09-11' }],
}

function setHooks({
  notices = { data: [NOTICE], loading: false, error: null, fetchedAt: Date.now(), refetch: vi.fn() },
  calendar = { data: CALENDAR, loading: false, error: null },
} = {}) {
  useSchoolBoardNotices.mockReturnValue(notices)
  useAcademicCalendar.mockReturnValue(calendar)
}

describe('AcademicNoticesPCContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
    vi.useFakeTimers()
    // 오늘: 2026-09-03(목) — CALENDAR.next.start_date(9/1)와 다른 날.
    vi.setSystemTime(new Date('2026-09-03T12:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 결함 #3: 캘린더 기본 선택이 진행 중인 학사일정의 시작일(next.start_date)로
  // 새어나가 오늘이 아닌 날이 채워져 보였다. PC에는 "다가오는 학사일정" 탭
  // 리스트가 없어(모바일과 달리) 그 날짜로 이동할 사용자 상호작용 자체가
  // 없으므로, 기본 선택은 항상 오늘이어야 한다.
  it('학사일정이 있어도 캘린더 기본 선택은 오늘이지 학사일정 시작일이 아니다', () => {
    render(<AcademicNoticesPCContent />)
    const today = screen.getByTestId('week-day-2026-09-03')
    const eventStart = screen.getByTestId('week-day-2026-09-01')

    expect(today).toHaveAttribute('aria-selected', 'true')
    expect(today).toHaveAttribute('data-today', 'true')
    expect(eventStart).toHaveAttribute('aria-selected', 'false')
  })

  // 결함 #4: "학교 공지" 라벨이 uppercase + tracking-widest(인라인 letterSpacing
  // 0.14em)를 받아 한글 낱글자가 흩어져 보였다. uppercase는 한글에 효과가 없고,
  // 라벨용 토큰(text-ghdr, letterSpacing 0.1em)으로 정리해야 한다.
  it('"학교 공지" 라벨은 인라인 letterSpacing 없이 라벨 토큰 클래스를 쓴다', () => {
    render(<AcademicNoticesPCContent />)
    const label = screen.getByText('학교 공지')
    expect(label).not.toHaveAttribute('style')
    expect(label.className).not.toContain('uppercase')
    expect(label.className).toContain('text-ghdr')
  })
})
