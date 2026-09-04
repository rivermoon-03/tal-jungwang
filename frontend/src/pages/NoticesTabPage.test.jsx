/**
 * NoticesTabPage(공지 탭) 테스트.
 *
 * 학사공지·앱 공지가 더보기에서 독립 탭으로 나왔다. 장학처럼 마감이 있는 공지의
 * 진입 경로가 "더보기 → 탭 전환"이면 늦게 본다는 게 분리 이유라, 기본 탭이
 * 학사공지이고 카테고리 칩이 바로 보이는지를 여기서 고정한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../hooks/useMore', () => ({
  useNotices: vi.fn(),
  useSchoolBoardNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

vi.mock('../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      pcNoticesTab: 'academic',
      setPcNoticesTab: vi.fn(),
    })
  ),
}))

vi.mock('../components/layout/PageHeader', () => ({
  default: ({ title, action }) => (
    <header data-testid="page-header">
      {title}
      {action}
    </header>
  ),
}))

// PC 분기는 PCSidebar 가 nav 를 담당한다 — 여기서는 모바일 경로만 검증한다.
vi.mock('../hooks/useMediaQuery', () => ({
  default: () => false,
  useIsDesktop: () => false,
}))

import { useNotices, useSchoolBoardNotices, useAcademicCalendar } from '../hooks/useMore'
import NoticesTabPage from './NoticesTabPage'

const MOCK_NOTICES = [
  { id: 1, title: '버스 도착 정보 개선', content: '도착 시간을 더 여유 있게 안내해요.', created_at: '2026-06-20T10:00:00Z' },
  { id: 2, title: '앱 업데이트 안내', content: '새로운 기능을 추가했어요.', created_at: '2026-06-18T09:00:00Z' },
]

const MOCK_SCHOOL_NOTICES = [
  {
    id: 151703,
    title: '2026학년도 2학기 수강신청 및 교과시간표 안내',
    url: 'https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do',
    published_at: '2026-07-16T00:00:00+09:00',
    category: '학사',
  },
]

const MOCK_CALENDAR = {
  next: { title: '기말고사', start_date: '2026-07-20', end_date: '2026-07-24' },
  upcoming: [],
}

// 탭 선택은 주소에 남는다(?tab=app). jsdom location 은 파일 안에서 공유되므로
// 앞 테스트가 바꾼 주소가 다음 테스트의 기본 탭을 바꾼다 — 매번 되돌린다.
beforeEach(() => {
  window.history.replaceState({}, '', '/notices')
})

function mockAllMoreHooks() {
  useNotices.mockReturnValue({ data: MOCK_NOTICES, loading: false, error: null })
  useSchoolBoardNotices.mockReturnValue({ data: MOCK_SCHOOL_NOTICES, loading: false, error: null })
  useAcademicCalendar.mockReturnValue({ data: MOCK_CALENDAR, loading: false, error: null })
}

function renderAppNoticesTab() {
  const utils = render(<NoticesTabPage />)
  fireEvent.click(screen.getByRole('tab', { name: '앱 공지' }))
  return utils
}

function hasInfoEmoji(text) {
  return /[\u{1F300}-\u{1FFFF}]/u.test(text)
}

function collectTextContent(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let text = ''
  let node = walker.nextNode()
  while (node) {
    text += node.textContent
    node = walker.nextNode()
  }
  return text
}

// ─── 시안1 NoticeHighlights 히어로 단언 ──────────────────────────────────────
describe('NoticeHighlights 시안1 — 히어로 강조 변형', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllMoreHooks()
  })

  it('히어로 카드에 "전체 공지 보기" CTA가 표시된다', () => {
    const { container } = renderAppNoticesTab()
    const text = collectTextContent(container)
    expect(text).toContain('전체 공지 보기')
  })

  it('히어로 내부에 ChevronRight(svg)가 존재한다', () => {
    const { container } = renderAppNoticesTab()
    // hero 영역(최상단 버튼) 내 svg가 있어야 한다
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('히어로 카드에 정보 이모지가 없다', () => {
    const { container } = renderAppNoticesTab()
    const text = collectTextContent(container)
    expect(hasInfoEmoji(text)).toBe(false)
  })

  it('"생색" 문구가 없다 ("~습니다" 미사용)', () => {
    const { container } = renderAppNoticesTab()
    const text = collectTextContent(container)
    expect(text).not.toMatch(/습니다/)
  })

  it('히어로 카드 본문 font-size가 12px 이상이다 (인라인)', () => {
    const { container } = renderAppNoticesTab()
    const allEls = container.querySelectorAll('[style]')
    allEls.forEach((el) => {
      const fs = el.style.fontSize
      if (fs && fs.endsWith('px')) {
        expect(
          Number(fs.replace('px', '')),
          `font-size ${fs}는 12px 미만입니다`
        ).toBeGreaterThanOrEqual(12)
      }
    })
  })
})

// ─── 세그먼트 탭 전환 · 학사공지 탭 통합 확인 ────────────────────────────────
describe('NoticesTabPage — 세그먼트 탭 [학사공지] [앱 공지]', () => {
  // MOCK_CALENDAR.next(7/20~7/24)가 "다가오는" 쪽에 들어가도록 오늘을 그보다
  // 앞선 날짜로 고정한다 — AcademicNoticesTab이 진행 중/다가오는을 나눈 뒤로는
  // 오늘 날짜에 따라 어느 목록에 들어가는지가 달라진다.
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T09:00:00+09:00'))
    mockAllMoreHooks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('기본 탭은 "학사공지"이며 카테고리 칩·D-day·공지 리스트를 보여준다(학과 드롭다운 제거)', () => {
    render(<NoticesTabPage />)
    expect(screen.getByRole('tab', { name: '학사공지' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('combobox', { name: '학과 선택' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '장학' })).toBeInTheDocument()
    expect(screen.getAllByText(/기말고사/).length).toBeGreaterThan(0)
    expect(screen.getByText('2026학년도 2학기 수강신청 및 교과시간표 안내')).toBeInTheDocument()
  })

  it('"앱 공지" 탭 클릭 시 학사공지 콘텐츠는 사라지고 앱 공지가 보인다', () => {
    render(<NoticesTabPage />)
    fireEvent.click(screen.getByRole('tab', { name: '앱 공지' }))

    expect(screen.getByRole('tab', { name: '앱 공지' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: '장학' })).not.toBeInTheDocument()
    // 히어로 카드와 "최근 공지" 목록 양쪽에 같은 제목이 나온다.
    expect(screen.getAllByText('버스 도착 정보 개선').length).toBeGreaterThan(0)
  })

  it('설정은 이 탭에 없다 — 더보기가 전담한다', () => {
    render(<NoticesTabPage />)
    fireEvent.click(screen.getByRole('tab', { name: '앱 공지' }))
    expect(screen.queryByText('개인정보처리방침')).not.toBeInTheDocument()
    expect(screen.queryByText('빠른 설정')).not.toBeInTheDocument()
  })

  it('학사공지 탭의 원문 링크는 새 탭(target=_blank) + rel=noopener noreferrer로 연다', () => {
    render(<NoticesTabPage />)
    const link = screen.getByRole('link', { name: /2026학년도 2학기 수강신청/ })
    expect(link).toHaveAttribute('href', MOCK_SCHOOL_NOTICES[0].url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })
})
