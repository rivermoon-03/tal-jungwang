/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭 단위 테스트.
 * 백엔드 API(/school/board-notices, /school/calendar)는 useMore 훅을 모킹해
 * 실제 네트워크 호출 없이 검증한다.
 *
 * DS1(2026-08): 학과 드롭다운/학과 공지 제거 → 전교 게시판 카테고리 칩.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useSchoolBoardNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import AcademicNoticesTab from './AcademicNoticesTab'

const NOTICE = {
  id: 151703,
  category: 'academic',
  category_label: '학사',
  title: '2026학년도 2학기 수강신청 및 교과시간표 안내',
  url: 'https://www.tukorea.ac.kr/bbs/tukorea/107/151703/artclView.do',
  published_at: '2026-07-16T00:00:00+09:00',
}

// "더 보기" 점진적 노출 검증용 — 응답이 이미 전체를 한 번에 내려주는 것을
// 가정해 7건을 모킹한다.
const MANY_NOTICES = Array.from({ length: 7 }, (_, i) => ({
  id: 200 + i,
  category: 'scholarship',
  category_label: '장학',
  title: `공지 제목 ${i + 1}`,
  url: `https://www.tukorea.ac.kr/bbs/tukorea/374/${200 + i}/artclView.do`,
  published_at: '2026-07-16T00:00:00+09:00',
}))

const CALENDAR = {
  next: { title: '기말고사', start_date: '2026-06-09', end_date: '2026-06-22' },
  upcoming: [
    { title: '하계방학 시작', start_date: '2026-06-23', end_date: '2026-06-23' },
    { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' },
  ],
}

function setHooks({
  notices = { data: [NOTICE], loading: false, error: null },
  calendar = { data: CALENDAR, loading: false, error: null },
} = {}) {
  useSchoolBoardNotices.mockReturnValue(notices)
  useAcademicCalendar.mockReturnValue(calendar)
}

describe('AcademicNoticesTab — 카테고리 칩 (DS1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('전체/학사/장학/취업/비교과/생활관 칩을 렌더링하고 기본은 전체다', () => {
    render(<AcademicNoticesTab />)
    for (const label of ['전체', '학사', '장학', '취업', '비교과', '생활관']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')
    expect(useSchoolBoardNotices).toHaveBeenLastCalledWith('all')
  })

  it('장학 칩을 누르면 scholarship 카테고리로 조회한다', () => {
    render(<AcademicNoticesTab />)
    fireEvent.click(screen.getByRole('button', { name: '장학' }))
    expect(screen.getByRole('button', { name: '장학' })).toHaveAttribute('aria-pressed', 'true')
    expect(useSchoolBoardNotices).toHaveBeenLastCalledWith('scholarship')
  })

  it('학과 선택 드롭다운은 더 이상 없다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/학과 공지/)).not.toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — 다가오는 학사일정 리스트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('D-N 칩과 제목, 날짜 범위를 표시한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText('다가오는 학사일정')).toHaveStyle({ letterSpacing: '-0.02em' })
    expect(screen.getAllByText(/^D[-+]\d+$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('기말고사').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6월 9일 ~ 6월 22일').length).toBeGreaterThan(0)
  })

  it('next(가장 임박)뿐 아니라 upcoming 항목도 리스트에 함께 보인다(상위 4개)', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText('하계방학 시작')).toBeInTheDocument()
    expect(screen.getByText('2학기 개강')).toBeInTheDocument()
  })

  it('next가 없으면 리스트도, D-day 칩도 렌더링하지 않는다', () => {
    setHooks({ calendar: { data: { next: null, upcoming: [] }, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.queryByText(/^D[-+]\d+$/)).not.toBeInTheDocument()
    expect(screen.queryByText('다가오는 학사일정')).not.toBeInTheDocument()
  })

  it('일정 항목을 탭하면 캘린더가 그 날짜로 이동한다(월 전체보기 기준월이 바뀜)', () => {
    render(<AcademicNoticesTab />)
    fireEvent.click(screen.getByRole('button', { name: /2학기 개강 · 캘린더에서 보기/ }))
    fireEvent.click(screen.getByRole('tab', { name: '월 전체보기' }))
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — 전체 일정 보기 모달', () => {
  const MANY_UPCOMING = {
    next: { title: '기말고사', start_date: '2026-06-09', end_date: '2026-06-22' },
    upcoming: [
      { title: '하계방학 시작', start_date: '2026-06-23', end_date: '2026-06-23' },
      { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' },
      { title: '수강정정', start_date: '2026-09-05', end_date: '2026-09-08' },
      { title: '중간고사', start_date: '2026-10-19', end_date: '2026-10-25' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setHooks({ calendar: { data: MANY_UPCOMING, loading: false, error: null } })
  })

  it('5개보다 많으면 "전체 일정 보기" 버튼이 보이고, 탭하면 나머지 항목도 모달에 보인다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.queryByText('중간고사')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('전체 일정 보기'))
    expect(screen.getByText('중간고사')).toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — 학교 공지 리스트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('제목·카테고리 뱃지·날짜·원문 링크를 렌더링한다', () => {
    setHooks()
    render(<AcademicNoticesTab />)
    const link = screen.getByRole('link', { name: /2026학년도 2학기 수강신청/ })
    expect(link).toHaveAttribute('href', NOTICE.url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    // '학사'는 칩 버튼과 리스트 뱃지 두 곳에 존재한다
    expect(screen.getAllByText('학사').length).toBeGreaterThanOrEqual(2)
  })

  it('로딩 중이면 로딩 문구를 보여준다', () => {
    setHooks({ notices: { data: null, loading: true, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText(/불러오는 중이에요/)).toBeInTheDocument()
  })

  it('에러가 나면 에러 문구를 보여준다', () => {
    setHooks({ notices: { data: null, loading: false, error: new Error('x') } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText(/공지사항을 불러오지 못했어요/)).toBeInTheDocument()
  })

  it('빈 배열이면 빈 상태 문구를 보여준다', () => {
    setHooks({ notices: { data: [], loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('이 카테고리의 새 공지가 없어요')).toBeInTheDocument()
  })

  it('처음에는 5개만 렌더링하고 "더 보기"를 누르면 나머지가 보인다', () => {
    setHooks({ notices: { data: MANY_NOTICES, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('공지 제목 5')).toBeInTheDocument()
    expect(screen.queryByText('공지 제목 6')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/더 보기 \(2개 더\)/))
    expect(screen.getByText('공지 제목 7')).toBeInTheDocument()
    expect(screen.queryByText(/더 보기 \(/)).not.toBeInTheDocument()
  })
})
