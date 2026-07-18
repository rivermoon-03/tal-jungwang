/**
 * MorePCLayout 테스트
 *
 * 좌측 rail(nav 4항목 + 다가오는 일정) + 우측 콘텐츠(activeNav에 따라 기존
 * 서브페이지 재사용). 네트워크 훅은 전부 useMore.js 모킹으로 대체하고,
 * D-day 배지는 vi.setSystemTime으로 고정한 KST 시각 기준으로 검증한다
 * (mistakes.md §1 — 실행 시각에 따라 결과가 바뀌면 안 된다).
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── 훅 모킹 (MorePage.test.jsx와 동일 패턴) ─────────────────────────────
vi.mock('../../hooks/useMore', () => ({
  useNotices: vi.fn(),
  useSchoolDepartments: vi.fn(),
  useSchoolNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

// SettingsPage가 쓰는 zustand 스토어 — fontScale/scheduleViewMode/commute*/favorites
// 전부 SettingsPage 렌더에 필요한 selector 값이라 전체를 모킹한다.
vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      fontScale: 1,
      setFontScale: vi.fn(),
      scheduleViewMode: 'grid',
      setScheduleViewMode: vi.fn(),
      commuteAutoMode: true,
      setCommuteAutoMode: vi.fn(),
      commuteManualDirection: '등교',
      setCommuteManualDirection: vi.fn(),
      favorites: { routes: [] },
    })
  ),
}))

// DarkModeSegment는 useAppStore(themeMode 등)를 직접 쓰므로 별도 스텁으로 대체
// (MorePage.test.jsx와 동일 전략).
vi.mock('./DarkModeSegment', () => ({
  default: () => <div data-testid="dark-mode-segment" />,
}))

// useMediaQuery는 기본적으로 실제 구현(jsdom matchMedia stub → false)을 쓰되,
// "MorePage 데스크톱 분기" describe에서만 강제로 override한다.
vi.mock('../../hooks/useMediaQuery', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    useIsDesktop: vi.fn(original.useIsDesktop),
  }
})

import { useNotices, useSchoolDepartments, useSchoolNotices, useAcademicCalendar } from '../../hooks/useMore'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import MorePCLayout from './MorePCLayout'
import MorePage from './MorePage'

const MOCK_NOTICES = [
  { id: 1, title: '버스 도착 정보 개선', content: '내용', created_at: '2026-06-20T10:00:00Z' },
]

const MOCK_DEPARTMENTS = [{ code: 'ce', label: '컴퓨터공학부' }]

const MOCK_SCHOOL_NOTICES = [
  {
    id: 151703,
    title: '2026학년도 2학기 수강신청 안내',
    url: 'https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do',
    published_at: '2026-07-16T00:00:00+09:00',
  },
]

// next(내일) + upcoming 5개 = 총 6개 중 앞 4개만 "다가오는 일정"에 노출되어야 한다.
const MOCK_CALENDAR = {
  next: { title: '기말고사', start_date: '2026-07-20', end_date: '2026-07-24' },
  upcoming: [
    { title: '성적정정기간', start_date: '2026-07-25', end_date: '2026-07-27' },
    { title: '하계방학 시작', start_date: '2026-08-01', end_date: '2026-08-01' },
    { title: '계절학기 시작', start_date: '2026-08-10', end_date: '2026-08-10' },
    { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' },
    { title: '추석 연휴', start_date: '2026-09-25', end_date: '2026-09-27' },
  ],
}

function mockAllMoreHooks() {
  useNotices.mockReturnValue({ data: MOCK_NOTICES, loading: false, error: null })
  useSchoolDepartments.mockReturnValue({ data: MOCK_DEPARTMENTS, loading: false, error: null })
  useSchoolNotices.mockReturnValue({ data: MOCK_SCHOOL_NOTICES, loading: false, error: null })
  useAcademicCalendar.mockReturnValue({ data: MOCK_CALENDAR, loading: false, error: null })
}

describe('MorePCLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllMoreHooks()
    vi.useFakeTimers()
    // 오늘: 2026-07-19(일) — next.start_date(2026-07-20)는 내일이므로 D-1이 된다.
    vi.setSystemTime(new Date('2026-07-19T10:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- (a) rail nav 4항목 + 기본 활성 ---
  it('rail에 nav 4항목(학사공지/앱 공지/설정/앱 정보)을 렌더하고 기본 활성은 학사공지다', () => {
    render(<MorePCLayout />)
    expect(screen.getByRole('button', { name: '학사공지' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '앱 공지' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '설정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '앱 정보' })).toBeInTheDocument()
    // 학사공지 콘텐츠(학과 select)가 기본으로 보인다
    expect(screen.getByRole('combobox', { name: '학과 선택' })).toBeInTheDocument()
  })

  // --- (b) nav 클릭 시 우측 콘텐츠 전환 ---
  it('설정 nav 클릭 시 우측 콘텐츠가 설정 화면(DarkModeSegment)으로 전환된다', () => {
    render(<MorePCLayout />)
    fireEvent.click(screen.getByRole('button', { name: '설정' }))

    expect(screen.getByRole('button', { name: '설정' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '학사공지' })).not.toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('dark-mode-segment')).toBeInTheDocument()
    // 학사공지 콘텐츠는 사라진다
    expect(screen.queryByRole('combobox', { name: '학과 선택' })).not.toBeInTheDocument()
  })

  it('앱 공지 nav 클릭 시 우측 콘텐츠가 공지사항 목록으로 전환된다', () => {
    render(<MorePCLayout />)
    fireEvent.click(screen.getByRole('button', { name: '앱 공지' }))
    expect(screen.getByText('버스 도착 정보 개선')).toBeInTheDocument()
  })

  // --- (c) initialNav ---
  it('initialNav="settings"면 설정이 처음부터 활성 상태로 렌더된다', () => {
    render(<MorePCLayout initialNav="settings" />)
    expect(screen.getByRole('button', { name: '설정' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('dark-mode-segment')).toBeInTheDocument()
  })

  // --- (d) 다가오는 일정 최대 4개 + D-day 배지 ---
  it('다가오는 일정은 최대 4개까지만 렌더하고, 가장 임박한 항목에 D-day 배지가 있다', () => {
    render(<MorePCLayout />)

    // 우측 콘텐츠(AcademicCalendarGrid)에도 같은 이벤트 제목이 나올 수 있으므로
    // rail의 "다가오는 일정" 섹션으로 범위를 좁혀서 검증한다.
    const railSection = screen.getByText('다가오는 일정').parentElement
    const withinRail = within(railSection)

    // next + upcoming 앞 3개 = 4개만 노출
    expect(withinRail.getByText('기말고사')).toBeInTheDocument()
    expect(withinRail.getByText('성적정정기간')).toBeInTheDocument()
    expect(withinRail.getByText('하계방학 시작')).toBeInTheDocument()
    expect(withinRail.getByText('계절학기 시작')).toBeInTheDocument()
    // 5, 6번째 항목은 잘려서 보이지 않아야 한다
    expect(withinRail.queryByText('2학기 개강')).not.toBeInTheDocument()
    expect(withinRail.queryByText('추석 연휴')).not.toBeInTheDocument()

    // 가장 임박한 항목(next, 내일=D-1)에 D-day 배지가 있다
    expect(withinRail.getByText('D-1')).toBeInTheDocument()
  })

  it('다가오는 일정이 없으면(next=null, upcoming=[]) 섹션 자체를 렌더하지 않는다', () => {
    useAcademicCalendar.mockReturnValue({ data: { next: null, upcoming: [] }, loading: false, error: null })
    render(<MorePCLayout />)
    expect(screen.queryByText('다가오는 일정')).not.toBeInTheDocument()
  })
})

// ─── MorePage 데스크톱 분기 배선 ────────────────────────────────────────
describe('MorePage — 데스크톱 분기', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllMoreHooks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('useIsDesktop=true면 MorePage가 세그먼트 탭 대신 PC rail(다가오는 일정)을 렌더한다', () => {
    useIsDesktop.mockReturnValue(true)
    render(<MorePage />)

    // PC 전용 rail 요소 — 모바일 세그먼트 탭에는 없는 "다가오는 일정" 섹션
    expect(screen.getByText('다가오는 일정')).toBeInTheDocument()
    // 모바일 세그먼트 탭("학사공지"/"설정 & 앱공지")은 tab role로 렌더되지 않는다
    // (AcademicCalendarGrid 내부의 월/주 뷰 전환은 별개의 tab이라 role만으로는
    // 판별할 수 없어, 모바일 세그먼트 탭 고유 라벨로 직접 확인한다)
    expect(screen.queryByRole('tab', { name: '설정 & 앱공지' })).not.toBeInTheDocument()
  })

  it('useIsDesktop=false면 기존 모바일 세그먼트 탭이 렌더된다(회귀 방지)', () => {
    useIsDesktop.mockReturnValue(false)
    render(<MorePage />)
    expect(screen.getByRole('tab', { name: '학사공지' })).toBeInTheDocument()
    expect(screen.queryByText('다가오는 일정')).not.toBeInTheDocument()
  })
})
