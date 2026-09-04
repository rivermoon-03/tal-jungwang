/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭 단위 테스트.
 * 백엔드 API(/school/board-notices, /school/calendar)는 useMore 훅을 모킹해
 * 실제 네트워크 호출 없이 검증한다.
 *
 * DS1(2026-08): 학과 드롭다운/학과 공지 제거 → 전교 게시판 카테고리 칩.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useSchoolBoardNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import { markNoticesSeen } from '../../utils/noticeReadState'
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

// 안읽음 도트는 기기 로컬(localStorage)에 마지막 확인 id를 남긴다 — 테스트마다
// 초기화하지 않으면 앞 테스트가 "확인함" 처리한 id가 다음 테스트로 새어나간다.
beforeEach(() => {
  localStorage.clear()
})

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
  // CALENDAR의 세 일정(기말고사 6/9, 하계방학 6/23, 개강 9/1)이 전부 "아직
  // 시작 전"이 되도록 오늘을 그보다 앞선 날짜로 고정한다 — 진행 중/다가오는
  // 구분이 생긴 뒤로는 오늘 날짜에 따라 어느 목록에 들어가는지가 달라진다.
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T09:00:00+09:00'))
    setHooks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('D-N 칩과 제목, 날짜 범위를 표시한다', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByText('다가오는 학사일정')).toHaveStyle({ letterSpacing: '-0.02em' })
    expect(screen.getAllByText(/^D[-+]\d+$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('기말고사').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6월 9일 ~ 6월 22일').length).toBeGreaterThan(0)
  })

  // 캘린더 기본 선택이 오늘로 바뀐 뒤로는 이번 주에 걸친 일정이 캘린더 레인에도
  // 같은 이름으로 그려진다. 그래서 텍스트로만 찾으면 리스트 항목과 캘린더 막대가
  // 같이 걸린다. 이 테스트가 확인하려는 건 "리스트에 보이는가" 이므로 역할로 좁힌다.
  it('next(가장 임박)뿐 아니라 upcoming 항목도 리스트에 함께 보인다(상위 4개)', () => {
    render(<AcademicNoticesTab />)
    expect(screen.getByRole('button', { name: /하계방학 시작/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2학기 개강/ })).toBeInTheDocument()
  })

  // 사용자가 아무것도 고르지 않았는데 다가오는 학사일정 시작일이 선택으로 칠해져
  // 열리던 결함. 캘린더는 오늘을 기본 선택으로 열어야 한다.
  it('처음 열 때 캘린더 기본 선택을 다가오는 일정 시작일로 강제하지 않는다', () => {
    render(<AcademicNoticesTab />)
    const grid = screen.getByTestId('week-lane-grid')
    expect(grid).toBeInTheDocument()
    // next.start_date(2026-06-09)가 속한 주가 아니라 오늘이 속한 주가 열려야 한다.
    expect(screen.queryByTestId('week-day-2026-06-09')).toBeNull()
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

// 결함: "26학년도 2학기 수강정정 및 확인 (9월 1일 ~ 9월 7일)"처럼 이미 시작한
// 일정(D+3)이 "다가오는 학사일정" 목록 맨 위에 섞여 있었다. D+는 이미 시작했다는
// 뜻이라 "다가오는"과 맞지 않는다 — 진행 중/다가오는을 별도 카드로 나눈다.
describe('AcademicNoticesTab — 진행 중인 학사일정 vs 다가오는 학사일정', () => {
  const CALENDAR_MIXED = {
    next: { title: '2학기 수강정정 및 확인', start_date: '2026-09-01', end_date: '2026-09-07' },
    upcoming: [{ title: '중간고사', start_date: '2026-10-19', end_date: '2026-10-25' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('이미 시작한 일정은 "진행 중인 학사일정" 아래 D+N 칩으로 보이고, "다가오는" 목록에는 없다', () => {
    vi.setSystemTime(new Date('2026-09-04T09:00:00+09:00')) // 9/1 시작 + 3일 = D+3
    setHooks({ calendar: { data: CALENDAR_MIXED, loading: false, error: null } })
    render(<AcademicNoticesTab />)

    const progressButton = screen.getByRole('button', { name: /2학기 수강정정 및 확인 · 캘린더에서 보기/ })
    expect(within(progressButton).getByText('D+3')).toBeInTheDocument()

    const upcomingHeading = screen.getByText('다가오는 학사일정')
    const upcomingList = upcomingHeading.nextElementSibling
    expect(within(upcomingList).queryByText('2학기 수강정정 및 확인')).not.toBeInTheDocument()
    expect(within(upcomingList).getByText('중간고사')).toBeInTheDocument()
  })

  it('"진행 중인 학사일정" 카드가 "다가오는 학사일정" 카드보다 먼저(DOM 상 위쪽) 나온다', () => {
    vi.setSystemTime(new Date('2026-09-04T09:00:00+09:00'))
    setHooks({ calendar: { data: CALENDAR_MIXED, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    const progressHeading = screen.getByText('진행 중인 학사일정')
    const upcomingHeading = screen.getByText('다가오는 학사일정')
    expect(progressHeading.compareDocumentPosition(upcomingHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('진행 중인 일정이 없으면 "진행 중인 학사일정" 섹션 자체가 없다', () => {
    vi.setSystemTime(new Date('2026-06-01T09:00:00+09:00'))
    setHooks({
      calendar: {
        data: { next: { title: '중간고사', start_date: '2026-10-19', end_date: '2026-10-25' }, upcoming: [] },
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    expect(screen.queryByText('진행 중인 학사일정')).not.toBeInTheDocument()
    expect(screen.getByText('다가오는 학사일정')).toBeInTheDocument()
  })

  it('경계: 오늘 시작하는 일정(D-DAY)은 "다가오는"이 아니라 "진행 중"이다', () => {
    vi.setSystemTime(new Date('2026-09-01T09:00:00+09:00'))
    setHooks({
      calendar: {
        data: { next: { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' }, upcoming: [] },
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('진행 중인 학사일정')).toBeInTheDocument()
    expect(screen.getByText('D-DAY')).toBeInTheDocument()
    expect(screen.queryByText('다가오는 학사일정')).not.toBeInTheDocument()
  })

  it('경계: 오늘 끝나는 일정은 "진행 중"이다', () => {
    vi.setSystemTime(new Date('2026-09-07T09:00:00+09:00'))
    setHooks({ calendar: { data: CALENDAR_MIXED, loading: false, error: null } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('진행 중인 학사일정')).toBeInTheDocument()
    expect(screen.getByText('D+6')).toBeInTheDocument()
  })

  it('경계: 이미 끝난 일정은 진행 중에도 다가오는에도 나타나지 않는다(방어적 처리)', () => {
    // end_date(9/7)보다 두 주 넘게 뒤인 오늘 — 캘린더 주간 레인이 오늘이 속한
    // 주를 기본으로 열므로, 그 주가 지난 일정 기간과 겹치지 않게 충분히 띄운다
    // (겹치면 캘린더 레인 막대에 같은 제목이 그려져 이 테스트의 취지와
    // 무관한 이유로 텍스트가 발견될 수 있다). upcoming은 비워서 "다가오는"
    // 쪽이 다른 이유로 뜨지 않게 한다 — 이 테스트가 보려는 건 진행 중 판정 하나뿐.
    vi.setSystemTime(new Date('2026-09-20T09:00:00+09:00'))
    setHooks({
      calendar: {
        data: { next: CALENDAR_MIXED.next, upcoming: [] },
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    expect(screen.queryByText('진행 중인 학사일정')).not.toBeInTheDocument()
    expect(screen.queryByText('다가오는 학사일정')).not.toBeInTheDocument()
    expect(screen.queryByText('2학기 수강정정 및 확인')).not.toBeInTheDocument()
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

  // 5개 일정(기말고사 6/9 ~ 중간고사 10/25)이 전부 "다가오는" 쪽에 들어가도록
  // 오늘을 가장 이른 일정보다 앞선 날짜로 고정한다.
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T09:00:00+09:00'))
    setHooks({ calendar: { data: MANY_UPCOMING, loading: false, error: null } })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('로딩 중이면 텍스트 대신 결과와 같은 모양의 스켈레톤을 보여준다', () => {
    setHooks({ notices: { data: null, loading: true, error: null } })
    const { container } = render(<AcademicNoticesTab />)
    // 텍스트 "불러오는 중이에요"는 더 이상 없다 — 로딩/빈/에러가 모두 같은
    // 문구 상자였던 것을 넷으로 구분하면서, 로딩은 실제 카드와 행 수가 같은
    // 스켈레톤(tj-skeleton)으로 바뀌었다(레이아웃 시프트 0).
    expect(screen.queryByText(/불러오는 중이에요/)).not.toBeInTheDocument()
    expect(container.querySelectorAll('.tj-skeleton').length).toBeGreaterThan(0)
  })

  it('에러가 나면 에러 문구와 다시 시도 버튼을 보여준다', () => {
    const refetch = vi.fn()
    setHooks({ notices: { data: null, loading: false, error: new Error('x'), refetch } })
    render(<AcademicNoticesTab />)
    expect(screen.getByText(/공지사항을 불러오지 못했어요/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))
    expect(refetch).toHaveBeenCalledTimes(1)
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

describe('AcademicNoticesTab — 정보 우선순위(공지 탭인데 첫 화면에 공지가 없던 결함)', () => {
  // CALENDAR의 일정이 전부 "다가오는" 쪽에 들어가도록 오늘을 앞선 날짜로 고정한다
  // (이 describe는 순서만 확인하므로 진행/다가오는 구분 자체는 상관없다).
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T09:00:00+09:00'))
    setHooks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('카테고리 칩이 학교 공지보다 먼저(DOM 상 위쪽) 렌더링된다', () => {
    const { container } = render(<AcademicNoticesTab />)
    const chipGroup = container.querySelector('[role="group"][aria-label="공지 카테고리 선택"]')
    const noticesHeading = screen.getByText('학교 공지')
    expect(chipGroup).not.toBeNull()
    expect(chipGroup.compareDocumentPosition(noticesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('학교 공지가 다가오는 학사일정보다 먼저(DOM 상 위쪽) 렌더링된다 — 탭 이름이 약속하는 콘텐츠가 먼저 와야 한다', () => {
    render(<AcademicNoticesTab />)
    const noticesHeading = screen.getByText('학교 공지')
    const upcomingHeading = screen.getByText('다가오는 학사일정')
    expect(noticesHeading.compareDocumentPosition(upcomingHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('AcademicNoticesTab — 안읽음 도트', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setHooks()
  })

  it('처음 보는 공지는 안읽음 도트가 켜진다', () => {
    render(<AcademicNoticesTab />)
    const link = screen.getByRole('link', { name: /안읽음 · 2026학년도 2학기 수강신청/ })
    expect(link.querySelector('span.bg-accent')).not.toBeNull()
  })

  it('이미 확인한 공지는 안읽음 도트가 없다(자리는 비어 있다)', () => {
    markNoticesSeen(NOTICE.category, [NOTICE.id])
    render(<AcademicNoticesTab />)
    const link = screen.getByRole('link', { name: /2026학년도 2학기 수강신청/ })
    expect(link.getAttribute('aria-label')).not.toMatch(/안읽음/)
    expect(link.querySelector('span.bg-accent')).toBeNull()
    // 자리는 그대로 남아 있어야 한다(정렬 유지) — 안읽음이든 아니든 같은 span이 존재.
    const dotSpan = link.querySelector('span.rounded-full.flex-shrink-0')
    expect(dotSpan).not.toBeNull()
    expect(dotSpan.className).toContain('h-[7px]')
    expect(dotSpan.className).toContain('w-[7px]')
  })

  it('읽은 항목은 행 전체가 흐리게(opacity) 처리된다', () => {
    markNoticesSeen(NOTICE.category, [NOTICE.id])
    render(<AcademicNoticesTab />)
    const link = screen.getByRole('link', { name: /2026학년도 2학기 수강신청/ })
    expect(link.className).toContain('opacity-70')
  })

  it('안읽은 항목은 opacity가 붙지 않는다', () => {
    render(<AcademicNoticesTab />)
    const link = screen.getByRole('link', { name: /안읽음 · 2026학년도 2학기 수강신청/ })
    expect(link.className).not.toContain('opacity-70')
  })
})

describe('AcademicNoticesTab — 카테고리별 칩 색', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('카테고리마다 칩 팔레트 클래스가 다르다(학사 파랑·장학 노랑·취업 초록·생활관 회색)', () => {
    const byCategory = [
      { category: 'academic', category_label: '학사', bg: 'bg-chip-blue-bg', fg: 'text-chip-blue-fg' },
      { category: 'scholarship', category_label: '장학', bg: 'bg-chip-yellow-bg', fg: 'text-chip-yellow-fg' },
      { category: 'job', category_label: '취업', bg: 'bg-chip-green-bg', fg: 'text-chip-green-fg' },
      { category: 'dorm', category_label: '생활관', bg: 'bg-chip-gray-bg', fg: 'text-chip-gray-fg' },
    ]
    const data = byCategory.map((c, i) => ({
      id: 300 + i,
      category: c.category,
      category_label: c.category_label,
      title: `${c.category_label} 공지 ${i}`,
      url: `https://example.com/${i}`,
      published_at: '2026-07-16T00:00:00+09:00',
    }))
    setHooks({ notices: { data, loading: false, error: null } })
    render(<AcademicNoticesTab />)

    for (const c of byCategory) {
      const chip = screen.getByText(c.category_label, { selector: 'span' })
      expect(chip.className).toContain(c.bg)
      expect(chip.className).toContain(c.fg)
    }
  })
})

describe('AcademicNoticesTab — 마감 D-day', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('제목에 마감 표기가 있으면 D-day 배지가 붙는다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T09:00:00+09:00'))
    setHooks({
      notices: {
        data: [{ ...NOTICE, id: 999, title: '국가장학금 2차 신청 7/20까지' }],
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    expect(screen.getByText('D-2')).toBeInTheDocument()
  })

  it('마감 표기가 없는 공지에는 D-day 배지가 없다', () => {
    setHooks()
    render(<AcademicNoticesTab />)
    expect(screen.queryByText(/^D-\d+$/)).not.toBeInTheDocument()
    expect(screen.queryByText('D-DAY')).not.toBeInTheDocument()
  })

  it('D-3 이내(임박)면 D-day 배지에 imminent 색이 붙는다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T09:00:00+09:00'))
    setHooks({
      notices: {
        data: [{ ...NOTICE, id: 999, title: '국가장학금 2차 신청 7/20까지' }],
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    const badge = screen.getByText('D-2')
    expect(badge.className).toContain('text-imminent')
  })

  it('D-3보다 여유 있으면 D-day 배지에 imminent 색이 붙지 않는다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T09:00:00+09:00'))
    setHooks({
      notices: {
        data: [{ ...NOTICE, id: 998, title: '국가장학금 2차 신청 7/20까지' }],
        loading: false,
        error: null,
      },
    })
    render(<AcademicNoticesTab />)
    const badge = screen.getByText('D-19')
    expect(badge.className).not.toContain('text-imminent')
    expect(badge.className).toContain('text-mute')
  })
})
