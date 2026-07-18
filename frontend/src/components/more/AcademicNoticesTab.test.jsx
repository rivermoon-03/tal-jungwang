/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭 단위 테스트.
 * 백엔드 API(/school/departments, /school/notices, /school/calendar)는
 * useMore 훅을 모킹해 실제 네트워크 호출 없이 검증한다.
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

// 가로 스크롤 점진 렌더링 검증용 — useSchoolNotices가 이미 전체를 한 번에
// 내려주는 것을 가정해 6건을 모킹하고, 화면에 처음 몇 개가 보이는지만 검증한다.
const MANY_NOTICES = Array.from({ length: 6 }, (_, i) => ({
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

describe('AcademicNoticesTab — D-day 배너', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('D-N 배지와 제목, 날짜 범위를 표시한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText(/^D[-+]\d+$/)).toBeInTheDocument()
    // 선택된 캘린더 날짜 아래에도 같은 제목/날짜범위가 표시될 수 있어 getAllByText로 확인.
    expect(screen.getAllByText('기말고사').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6월 9일 ~ 6월 22일').length).toBeGreaterThan(0)
  })

  it('"다가오는 일정" 텍스트 라벨 없이 월간 캘린더 그리드를 바로 렌더링한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.queryByText('다가오는 일정')).not.toBeInTheDocument()
    // next(기말고사) start_date가 2026-06-09이므로 초기 달은 2026년 6월.
    expect(screen.getByText('2026년 6월')).toBeInTheDocument()
    // 6/9는 이벤트 범위(6/9~6/22) 시작일이라 그리드에 날짜 셀이 존재해야 한다.
    expect(screen.getByTestId('cal-day-2026-06-09')).toBeInTheDocument()
  })

  it('next가 없으면 D-day 배너를 렌더링하지 않는다', () => {
    setHooks({ calendar: { data: { next: null, upcoming: [] }, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.queryByText(/^D[-+]\d+$/)).not.toBeInTheDocument()
  })

  it('next와 upcoming이 모두 없으면 캘린더 그리드도 렌더링하지 않는다', () => {
    setHooks({ calendar: { data: { next: null, upcoming: [] }, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.queryByTestId('cal-day-2026-06-09')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('D-day 배너는 탭 가능한 버튼이다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByRole('button', { name: /다가오는 일정 더 보기/ })).toBeInTheDocument()
  })
})

describe('AcademicNoticesTab — D-day 배너 탭 → 다가오는 일정 모달', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('배너를 탭하면 모달이 열리고 upcoming 항목(제목+날짜)을 보여준다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.queryByText('하계방학 시작')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /다가오는 일정 더 보기/ }))

    expect(screen.getByText('하계방학 시작')).toBeInTheDocument()
    expect(screen.getByText('6월 23일')).toBeInTheDocument()
    expect(screen.getByText('2학기 개강')).toBeInTheDocument()
    expect(screen.getByText('9월 1일')).toBeInTheDocument()
  })

  it('upcoming이 3개 미만이면 있는 만큼만 보여준다', () => {
    setHooks({
      calendar: {
        data: {
          next: { title: '기말고사', start_date: '2026-06-09', end_date: '2026-06-22' },
          upcoming: [{ title: '하계방학 시작', start_date: '2026-06-23', end_date: '2026-06-23' }],
        },
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    fireEvent.click(screen.getByRole('button', { name: /다가오는 일정 더 보기/ }))
    expect(screen.getByText('하계방학 시작')).toBeInTheDocument()
    expect(screen.queryByText('2학기 개강')).not.toBeInTheDocument()
  })

  it('닫기 버튼을 누르면 모달이 닫힌다', () => {
    render(<AcademicNoticesTab />)
    fireEvent.click(screen.getByRole('button', { name: /다가오는 일정 더 보기/ }))
    expect(screen.getByText('하계방학 시작')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByText('하계방학 시작')).not.toBeInTheDocument()
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

describe('AcademicNoticesTab — 학과 공지 가로 스크롤 점진 렌더링', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks({ notices: { data: MANY_NOTICES, loading: false, error: null } })
  })

  // 스크롤 컨테이너의 레이아웃 프로퍼티를 원하는 값으로 강제한다.
  // jsdom은 실제 레이아웃을 계산하지 않으므로 scrollLeft/clientWidth/scrollWidth가
  // 항상 0이라, defineProperty로 "끝 근처까지 스크롤한" 상태를 시뮬레이션한다.
  function setScrollGeometry(el, { scrollLeft, clientWidth, scrollWidth }) {
    Object.defineProperty(el, 'scrollLeft', { configurable: true, value: scrollLeft })
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth })
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth })
  }

  it('처음에는 3개만 렌더링한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText('공지 제목 1')).toBeInTheDocument()
    expect(screen.getByText('공지 제목 3')).toBeInTheDocument()
    expect(screen.queryByText('공지 제목 4')).not.toBeInTheDocument()
  })

  it('끝에서 먼 지점으로 스크롤하면 더 렌더링하지 않는다', () => {
    render(<AcademicNoticesTab />)
    const scrollEl = screen.getByTestId('notices-scroll')

    setScrollGeometry(scrollEl, { scrollLeft: 50, clientWidth: 300, scrollWidth: 1000 })
    fireEvent.scroll(scrollEl)

    expect(screen.queryByText('공지 제목 4')).not.toBeInTheDocument()
  })

  it('스크롤이 끝 근처에 도달하면 3개씩 더 렌더링한다', () => {
    render(<AcademicNoticesTab />)
    const scrollEl = screen.getByTestId('notices-scroll')

    // clientWidth(300) + scrollLeft(650) >= scrollWidth(1000) - threshold(80)
    setScrollGeometry(scrollEl, { scrollLeft: 650, clientWidth: 300, scrollWidth: 1000 })
    fireEvent.scroll(scrollEl)

    expect(screen.getByText('공지 제목 4')).toBeInTheDocument()
    expect(screen.getByText('공지 제목 6')).toBeInTheDocument()

    // 이미 전체(6건)를 다 보여주고 있으므로 추가 스크롤해도 그대로 6건이다(초과 렌더링 없음).
    fireEvent.scroll(scrollEl)
    expect(screen.getAllByRole('link')).toHaveLength(6)
  })
})
