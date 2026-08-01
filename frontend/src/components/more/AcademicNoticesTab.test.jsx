/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭 단위 테스트.
 * 백엔드 API(/school/departments, /school/notices, /school/calendar)는
 * useMore 훅을 모킹해 실제 네트워크 호출 없이 검증한다.
 *
 * 결함 #34 재구성: "다가오는 학사일정" 리스트(상위 4개, D-day 칩+제목+기간)가
 * 대문이 되고, 캘린더는 그 아래(기본 주간 스트립), 학과 공지는 세로 리스트다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
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

// 세로 리스트 "더 보기" 점진적 노출 검증용 — useSchoolNotices가 이미 전체를 한
// 번에 내려주는 것을 가정해 7건을 모킹하고, 화면에 처음 몇 개가 보이는지 +
// "더 보기" 클릭 후 몇 개가 늘어나는지만 검증한다.
const MANY_NOTICES = Array.from({ length: 7 }, (_, i) => ({
  id: 200 + i,
  title: `공지 제목 ${i + 1}`,
  url: `https://www.tukorea.ac.kr/bbs/ce/201/${200 + i}/artclView.do`,
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

describe('AcademicNoticesTab — 미지원 학과', () => {
  const DEPARTMENTS_WITH_UNSUPPORTED = [
    { code: 'ce', label: '컴퓨터공학부', supported: true },
    {
      code: 'ee',
      label: '전자공학부',
      supported: false,
      unsupported_reason: '학교 웹사이트 정책(robots.txt)상 컴퓨터공학부 게시판만 공지 수집이 허용되어 있어요. 이 학과는 아직 지원하지 않아요.',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미지원 학과 옵션 라벨에 "(준비 중)" 표시가 붙는다', () => {
    setHooks({ departments: { data: DEPARTMENTS_WITH_UNSUPPORTED, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByRole('option', { name: '전자공학부 (준비 중)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '컴퓨터공학부' })).toBeInTheDocument()
  })

  it('미지원 학과를 선택하면 공지 대신 미지원 사유 안내를 보여주고 notices를 조회하지 않는다', () => {
    setHooks({ departments: { data: DEPARTMENTS_WITH_UNSUPPORTED, loading: false, error: null } })
    render(<AcademicNoticesTab />)

    fireEvent.change(screen.getByRole('combobox', { name: '학과 선택' }), { target: { value: 'ee' } })

    expect(screen.getByText(/robots\.txt/)).toBeInTheDocument()
    expect(screen.queryByText('새 학과 공지가 없어요')).not.toBeInTheDocument()
    expect(useSchoolNotices).toHaveBeenLastCalledWith(null)
  })

  it('지원 학과로 다시 바꾸면 안내 문구가 사라지고 공지 목록을 조회한다', () => {
    setHooks({ departments: { data: DEPARTMENTS_WITH_UNSUPPORTED, loading: false, error: null } })
    render(<AcademicNoticesTab />)

    const select = screen.getByRole('combobox', { name: '학과 선택' })
    fireEvent.change(select, { target: { value: 'ee' } })
    fireEvent.change(select, { target: { value: 'ce' } })

    expect(screen.queryByText(/robots\.txt/)).not.toBeInTheDocument()
    expect(useSchoolNotices).toHaveBeenLastCalledWith('ce')
  })
})

describe('AcademicNoticesTab — 다가오는 학사일정 리스트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('D-N 칩과 제목, 날짜 범위를 표시한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getAllByText(/^D[-+]\d+$/).length).toBeGreaterThan(0)
    // 선택된 캘린더 날짜 아래에도 같은 제목/날짜범위가 표시될 수 있어 getAllByText로 확인.
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

  it('next와 upcoming이 모두 없으면 캘린더도 렌더링하지 않는다', () => {
    setHooks({ calendar: { data: { next: null, upcoming: [] }, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('항목이 4개 이하이면 "전체 일정 보기" 버튼이 없다', () => {
    render(<AcademicNoticesTab />)
    // next 1개 + upcoming 2개 = 3개 ≤ 4
    expect(screen.queryByText('전체 일정 보기')).not.toBeInTheDocument()
  })

  it('일정 항목을 탭하면 캘린더가 그 날짜로 이동한다(월 전체보기 기준월이 바뀜)', () => {
    render(<AcademicNoticesTab />)
    // aria-label은 "·"(가운뎃점)로 구분한다 — UI 렌더 텍스트에 em-dash("—") 미사용.
    fireEvent.click(screen.getByRole('button', { name: /2학기 개강 · 캘린더에서 보기/ }))
    fireEvent.click(screen.getByRole('tab', { name: '월 전체보기' }))
    // 2학기 개강(9/1)로 포커스가 이동했으므로 캘린더 기준월이 9월이어야 한다.
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

  it('모달에서 항목을 탭하면 캘린더가 그 날짜로 이동한다', () => {
    render(<AcademicNoticesTab />)
    fireEvent.click(screen.getByText('전체 일정 보기'))
    fireEvent.click(screen.getByText('중간고사'))

    fireEvent.click(screen.getByRole('tab', { name: '월 전체보기' }))
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — 학과 공지 리스트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('제목·날짜·원문 링크를 렌더링한다', () => {
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

describe('AcademicNoticesTab — 학과 공지 "더 보기" 점진적 노출', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks({ notices: { data: MANY_NOTICES, loading: false, error: null } })
  })

  it('처음에는 5개만 렌더링하고 "더 보기" 버튼이 있다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText('공지 제목 1')).toBeInTheDocument()
    expect(screen.getByText('공지 제목 5')).toBeInTheDocument()
    expect(screen.queryByText('공지 제목 6')).not.toBeInTheDocument()
    expect(screen.getByText(/더 보기/)).toBeInTheDocument()
  })

  it('"더 보기"를 누르면 나머지가 모두 보이고 버튼이 사라진다', () => {
    render(<AcademicNoticesTab />)
    fireEvent.click(screen.getByText(/더 보기/))
    expect(screen.getByText('공지 제목 6')).toBeInTheDocument()
    expect(screen.getByText('공지 제목 7')).toBeInTheDocument()
    expect(screen.queryByText(/더 보기/)).not.toBeInTheDocument()
  })
})
