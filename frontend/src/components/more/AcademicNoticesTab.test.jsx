/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭 단위 테스트.
 * 백엔드 API(/school/departments, /school/notices, /school/calendar)는
 * useMore 훅을 모킹해 실제 네트워크 호출 없이 검증한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useSchoolDepartments: vi.fn(),
  useSchoolNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

import { useSchoolDepartments, useSchoolNotices, useAcademicCalendar } from '../../hooks/useMore'
import AcademicNoticesTab from './AcademicNoticesTab'

const ONE_DEPARTMENT = [{ code: 'ce', label: '컴퓨터공학부' }]

const NOTICE = {
  id: 151703,
  title: '2026학년도 2학기 수강신청 및 교과시간표 안내',
  url: 'https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do',
  published_at: '2026-07-16T00:00:00+09:00',
}

const CALENDAR = {
  next: { title: '기말고사', start_date: '2026-06-09', end_date: '2026-06-22' },
  upcoming: [
    { title: '하계방학 시작', start_date: '2026-06-23', end_date: '2026-06-23' },
    { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' },
  ],
}

function setHooks({
  departments = { data: ONE_DEPARTMENT, loading: false, error: null },
  notices = { data: [NOTICE], loading: false, error: null },
  calendar = { data: CALENDAR, loading: false, error: null },
} = {}) {
  useSchoolDepartments.mockReturnValue(departments)
  useSchoolNotices.mockReturnValue(notices)
  useAcademicCalendar.mockReturnValue(calendar)
}

describe('AcademicNoticesTab — 학과 드롭다운', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('옵션이 1개(컴공)뿐이어도 드롭다운을 렌더링한다', () => {
    setHooks()
    render(<AcademicNoticesTab />)
    const select = screen.getByRole('combobox', { name: '학과 선택' })
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '컴퓨터공학부' })).toBeInTheDocument()
  })

  it('학과가 여러 개면 여러 옵션을 하드코딩 없이 그대로 렌더링한다', () => {
    setHooks({
      departments: {
        data: [
          { code: 'ce', label: '컴퓨터공학부' },
          { code: 'me', label: '기계공학부' },
        ],
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    expect(screen.getByRole('option', { name: '컴퓨터공학부' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '기계공학부' })).toBeInTheDocument()
  })

  it('학과 목록이 비어 있으면 드롭다운을 렌더링하지 않는다', () => {
    setHooks({ departments: { data: [], loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.queryByRole('combobox', { name: '학과 선택' })).not.toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — D-day 배너', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('"D-N · 제목" 형식과 날짜 범위를 표시한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText(/D[-+]\d+ · 기말고사/)).toBeInTheDocument()
    expect(screen.getByText('6월 9일 ~ 6월 22일')).toBeInTheDocument()
  })

  it('다가오는 일정 리스트를 렌더링한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText('하계방학 시작')).toBeInTheDocument()
    expect(screen.getByText('2학기 개강')).toBeInTheDocument()
    expect(screen.getByText('9월 1일')).toBeInTheDocument()
  })

  it('next가 없으면 D-day 배너를 렌더링하지 않는다', () => {
    setHooks({ calendar: { data: { next: null, upcoming: [] }, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.queryByText(/D[-+]\d+/)).not.toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — 공지 리스트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('제목·날짜·배지·원문 링크를 렌더링한다', () => {
    setHooks()
    render(<AcademicNoticesTab />)
    expect(screen.getByText(NOTICE.title)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: new RegExp(NOTICE.title) })
    expect(link).toHaveAttribute('href', NOTICE.url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('로딩 중이면 로딩 문구를 보여준다', () => {
    setHooks({ notices: { data: null, loading: true, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('불러오는 중이에요...')).toBeInTheDocument()
  })

  it('에러가 나면 에러 문구를 보여준다', () => {
    setHooks({ notices: { data: null, loading: false, error: new Error('fail') } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('공지사항을 불러오지 못했어요')).toBeInTheDocument()
  })

  it('빈 배열이면 빈 상태 문구를 보여준다', () => {
    setHooks({ notices: { data: [], loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('새 학과 공지가 없어요')).toBeInTheDocument()
  })
})
