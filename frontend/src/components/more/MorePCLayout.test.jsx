/**
 * MorePCLayout 테스트
 *
 * 공지(학사공지/앱 공지)는 공지 탭으로 나갔고, 여기 남은 nav는 설정/도움말/
 * 앱 정보 셋이다. nav 자체는 PCSidebar 하단 설정 섹션이 그린다
 * (PCSidebar.test.jsx에서 별도 검증). 이 컴포넌트는 activeNav(=initialNav
 * prop, store가 있으면 store.pcMoreNav)에 대응하는 전폭 콘텐츠만 그린다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── 훅 모킹 (MorePage.test.jsx와 동일 패턴) ─────────────────────────────
vi.mock('../../hooks/useMore', () => ({
  useNotices: vi.fn(),
  useSchoolBoardNotices: vi.fn(),
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
      // B1 막차 알림 — SettingsPage가 lastTrainAlert.enabled를 읽으므로 필수
      lastTrainAlert: { enabled: false, leadMin: 30 },
      setLastTrainAlert: vi.fn(),
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

import { useNotices, useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
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
  useSchoolBoardNotices.mockReturnValue({ data: MOCK_SCHOOL_NOTICES, loading: false, error: null })
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

  // --- (a) 기본 렌더: initialNav 기본값(settings) ---
  it('기본(initialNav 없음)이면 설정 콘텐츠와 헤더를 렌더한다', () => {
    render(<MorePCLayout />)
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
    expect(screen.getByTestId('dark-mode-segment')).toBeInTheDocument()
  })

  // --- (b) initialNav prop으로 각 섹션이 전환된다 (nav 자체는 PCSidebar로 이관) ---
  it('initialNav="settings"면 설정 화면(DarkModeSegment)이 렌더된다', () => {
    render(<MorePCLayout initialNav="settings" />)
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
    expect(screen.getByTestId('dark-mode-segment')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '학과 선택' })).not.toBeInTheDocument()
  })

  it('initialNav="help"면 도움말이 렌더된다', () => {
    render(<MorePCLayout initialNav="help" />)
    expect(screen.getByRole('heading', { name: '도움말' })).toBeInTheDocument()
    expect(screen.getByText('홈 화면 위젯')).toBeInTheDocument()
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

  it('useIsDesktop=true면 MorePage가 PC 전폭 레이아웃(설정)을 렌더한다', () => {
    useIsDesktop.mockReturnValue(true)
    render(<MorePage />)
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
    expect(screen.getByTestId('dark-mode-segment')).toBeInTheDocument()
  })

  it('useIsDesktop=false면 모바일 진입 목록(설정·도움말·앱 정보)이 렌더된다', () => {
    useIsDesktop.mockReturnValue(false)
    render(<MorePage />)
    // 공지가 공지 탭으로 나가면서 세그먼트 탭 자체가 사라졌다.
    expect(screen.queryByRole('tab', { name: '학사공지' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '설정 열기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '도움말 열기' })).toBeInTheDocument()
  })
})
