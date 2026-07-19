/**
 * MorePCLayout 테스트
 *
 * nav(학사공지/앱 공지/설정/앱 정보)는 더 이상 이 컴포넌트가 rail로 그리지
 * 않는다 — PCSidebar의 컨텍스트 서브내비 + 설정 섹션으로 이관됐다
 * (PCSidebar.test.jsx에서 별도 검증). 이 컴포넌트는 activeNav(=initialNav
 * prop, store가 있으면 store.pcMoreNav)에 대응하는 전폭 콘텐츠만 그린다.
 * 네트워크 훅은 전부 useMore.js 모킹으로 대체하고, D-day 배지는
 * vi.setSystemTime으로 고정한 KST 시각 기준으로 검증한다(mistakes.md §1 —
 * 실행 시각에 따라 결과가 바뀌면 안 된다).
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

  // --- (a) 기본 렌더: initialNav 기본값(academic) ---
  it('기본(initialNav 없음)이면 학사공지 콘텐츠와 헤더를 렌더한다', () => {
    render(<MorePCLayout />)
    expect(screen.getByRole('heading', { name: '학사공지' })).toBeInTheDocument()
    // 학사공지 콘텐츠(학과 select)가 기본으로 보인다
    expect(screen.getByRole('combobox', { name: '학과 선택' })).toBeInTheDocument()
  })

  // --- (b) initialNav prop으로 각 섹션이 전환된다 (nav 자체는 PCSidebar로 이관) ---
  it('initialNav="settings"면 설정 화면(DarkModeSegment)이 렌더된다', () => {
    render(<MorePCLayout initialNav="settings" />)
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
    expect(screen.getByTestId('dark-mode-segment')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '학과 선택' })).not.toBeInTheDocument()
  })

  it('initialNav="notices"면 공지사항 목록이 렌더된다', () => {
    render(<MorePCLayout initialNav="notices" />)
    expect(screen.getByText('버스 도착 정보 개선')).toBeInTheDocument()
  })

  it('initialNav="app-info"면 앱 정보가 렌더된다', () => {
    render(<MorePCLayout initialNav="app-info" />)
    expect(screen.getByRole('heading', { name: '앱 정보' })).toBeInTheDocument()
  })

  // --- (c) 설정 화면 내부의 "앱 정보 · 오픈소스" 행이 여전히 앱 정보로 전환한다 ---
  it('설정 화면에서 "앱 정보 · 오픈소스" 클릭 시 앱 정보 콘텐츠로 전환된다', () => {
    render(<MorePCLayout initialNav="settings" />)
    fireEvent.click(screen.getByText('앱 정보 · 오픈소스'))
    expect(screen.getByRole('heading', { name: '앱 정보' })).toBeInTheDocument()
  })

  // --- (d) 다가오는 일정 최대 4개 + D-day 배지 (학사공지 헤더에만 노출) ---
  it('다가오는 일정은 최대 4개까지만 렌더하고, 가장 임박한 항목에 D-day 배지가 있다', () => {
    render(<MorePCLayout />)

    // 우측 콘텐츠(AcademicCalendarGrid)에도 같은 이벤트 제목이 나올 수 있으므로
    // 헤더의 "다가오는 일정" 섹션으로 범위를 좁혀서 검증한다.
    const headerSection = screen.getByText('다가오는 일정').closest('div').parentElement
    const withinHeader = within(headerSection)

    // next + upcoming 앞 3개 = 4개만 노출
    expect(withinHeader.getByText('기말고사')).toBeInTheDocument()
    expect(withinHeader.getByText('성적정정기간')).toBeInTheDocument()
    expect(withinHeader.getByText('하계방학 시작')).toBeInTheDocument()
    expect(withinHeader.getByText('계절학기 시작')).toBeInTheDocument()
    // 5, 6번째 항목은 잘려서 보이지 않아야 한다
    expect(withinHeader.queryByText('2학기 개강')).not.toBeInTheDocument()
    expect(withinHeader.queryByText('추석 연휴')).not.toBeInTheDocument()

    // 가장 임박한 항목(next, 내일=D-1)에 D-day 배지가 있다
    expect(withinHeader.getByText('D-1')).toBeInTheDocument()
  })

  it('다가오는 일정이 없으면(next=null, upcoming=[]) 섹션 자체를 렌더하지 않는다', () => {
    useAcademicCalendar.mockReturnValue({ data: { next: null, upcoming: [] }, loading: false, error: null })
    render(<MorePCLayout />)
    expect(screen.queryByText('다가오는 일정')).not.toBeInTheDocument()
  })

  it('학사공지가 아닌 섹션에서는 다가오는 일정을 렌더하지 않는다', () => {
    render(<MorePCLayout initialNav="notices" />)
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
