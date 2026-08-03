/**
 * MorePage / 더보기 그룹 품질 테스트
 *
 * 공지(학사공지·앱 공지)는 공지 탭으로 나갔다 — NoticesTabPage.test.jsx 참조.
 *
 * 검사 항목:
 *  1. 정보 표현 이모지(Extended_Pictographic) 없음 — lucide 아이콘 사용
 *  2. 9~11px 인라인 font-size 미사용
 *  3. ChevronRight 아이콘 사용 (진입 화살표 "→" 텍스트 금지)
 *  4. "→" 텍스트 화살표 미사용
 *  5. AppInfoPage 🏫 이모지 없음
 */
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 훅 모킹 ──────────────────────────────────────────────────────────────
vi.mock('../hooks/useMore', () => ({
  useNotices: vi.fn(),
  useSchoolBoardNotices: vi.fn(),
  useAcademicCalendar: vi.fn(),
}))

vi.mock('../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      themeMode: 'system',
      notifPrefs: { enabled: true, leadMin: 10 },
      setThemeMode: vi.fn(),
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

// D6 테스트에서 헤더 설정 버튼 → 설정 서브페이지 전환만 검증한다.
// 실제 SettingsPage는 push/store 의존이 많아 여기서는 스텁으로 충분하다.
vi.mock('../components/more/SettingsPage', () => ({
  default: () => <div data-testid="settings-page" />,
}))

// DarkModeSegment는 useAppStore를 직접 사용하므로 모킹
vi.mock('../components/more/DarkModeSegment', () => ({
  default: () => <div data-testid="dark-mode-segment" />,
}))

import { useNotices, useSchoolBoardNotices, useAcademicCalendar } from '../hooks/useMore'
import MorePageContent from '../components/more/MorePage'
import AppInfoPage from '../components/more/AppInfoPage'
import DarkModePage from '../components/more/DarkModePage'
import NoticesPage from '../components/more/NoticesPage'
import NotificationsPage from '../components/more/NotificationsPage'

const MOCK_NOTICES = [
  { id: 1, title: '버스 도착 정보 개선', content: '버스가 표시보다 일찍 떠나는 일이 줄도록 도착 시간을 더 여유 있게 안내해요.', created_at: '2026-06-20T10:00:00Z' },
  { id: 2, title: '앱 업데이트 안내', content: '새로운 기능을 추가했어요.', created_at: '2026-06-18T09:00:00Z' },
]

const MOCK_DEPARTMENTS = [{ code: 'ce', label: '컴퓨터공학부' }]

const MOCK_SCHOOL_NOTICES = [
  {
    id: 151703,
    title: '2026학년도 2학기 수강신청 및 교과시간표 안내',
    url: 'https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do',
    published_at: '2026-07-16T00:00:00+09:00',
  },
]

const MOCK_CALENDAR = {
  next: { title: '기말고사', start_date: '2026-06-09', end_date: '2026-06-22' },
  upcoming: [
    { title: '하계방학 시작', start_date: '2026-06-23', end_date: '2026-06-23' },
    { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' },
  ],
}

// 더보기 기본(첫) 탭이 "학사공지"라 MorePageContent를 렌더링하는 모든 테스트는
// AcademicNoticesTab이 쓰는 훅도 함께 모킹해야 실제 네트워크 호출 없이 동작한다.
function mockAllMoreHooks() {
  useNotices.mockReturnValue({ data: MOCK_NOTICES, loading: false, error: null })
  useSchoolBoardNotices.mockReturnValue({ data: MOCK_SCHOOL_NOTICES, loading: false, error: null })
  useAcademicCalendar.mockReturnValue({ data: MOCK_CALENDAR, loading: false, error: null })
}

// "앱 공지" 탭(예전 기본 화면)으로 전환해 렌더링 — 히어로 카드 등은 이 탭에 있다.
// Extended_Pictographic 유니코드 범위를 간략히 커버하는 정규식
// 주요 이모지 블록을 체크 (U+1F300~U+1FFFF 범위)
function hasInfoEmoji(text) {
  return /[\u{1F300}-\u{1FFFF}]/u.test(text)
}

// 컨테이너 내 모든 텍스트 노드 수집
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

describe('MorePage — 품질 규칙', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllMoreHooks()
  })

  it('진입 화살표로 ChevronRight SVG를 사용하고 "→" 텍스트를 쓰지 않는다', () => {
    const { container } = render(<MorePageContent />)
    // "→" 텍스트가 없어야 한다
    const text = collectTextContent(container)
    expect(text).not.toContain('→')
    // ChevronRight svg 존재 여부 (lucide-react는 role="img" 또는 aria-hidden svg)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('인라인 font-size가 12px 미만인 요소가 없다', () => {
    const { container } = render(<MorePageContent />)
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

  it('정보 표현 이모지를 텍스트로 쓰지 않는다', () => {
    const { container } = render(<MorePageContent />)
    const text = collectTextContent(container)
    expect(hasInfoEmoji(text)).toBe(false)
  })
})

describe('AppInfoPage — 품질 규칙', () => {
  it('🏫 이모지 대신 lucide 아이콘을 사용한다', () => {
    const { container } = render(<AppInfoPage onBack={() => {}} />)
    const text = collectTextContent(container)
    // 🏫 이모지(U+1F3EB)가 없어야 한다
    expect(text).not.toContain('🏫')
    // svg 아이콘은 존재해야 한다
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0)
  })

  it('정보 표현 이모지를 텍스트로 쓰지 않는다', () => {
    const { container } = render(<AppInfoPage onBack={() => {}} />)
    const text = collectTextContent(container)
    expect(hasInfoEmoji(text)).toBe(false)
  })

  it('"~요" 톤으로 작성되어 있다 — "~습니다" 미사용', () => {
    const { container } = render(<AppInfoPage onBack={() => {}} />)
    const text = collectTextContent(container)
    expect(text).not.toMatch(/습니다/)
  })
})

describe('DarkModePage — 품질 규칙', () => {
  it('"~습니다" 대신 "~요" 톤을 사용한다', () => {
    const { container } = render(<DarkModePage onBack={() => {}} />)
    const text = collectTextContent(container)
    expect(text).not.toMatch(/습니다/)
  })
})

describe('NoticesPage — 품질 규칙', () => {
  beforeEach(() => {
    useNotices.mockReturnValue({ data: MOCK_NOTICES, loading: false, error: null })
  })

  it('인라인 font-size가 12px 미만인 요소가 없다', () => {
    const { container } = render(<NoticesPage onBack={() => {}} />)
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

describe('NotificationsPage — 품질 규칙', () => {
  it('정보 표현 이모지를 쓰지 않는다', () => {
    const { container } = render(<NotificationsPage onBack={() => {}} />)
    const text = collectTextContent(container)
    expect(hasInfoEmoji(text)).toBe(false)
  })

  it('"개발 중" 플레이스홀더 대신 실제 알림 안내를 보여준다', () => {
    const { container } = render(<NotificationsPage onBack={() => {}} />)
    const text = collectTextContent(container)
    expect(text).not.toContain('개발 중')
    // 실동작 항목(막차·노선 알림)과 준비 중 항목이 구분돼야 한다
    expect(text).toContain('막차 알림')
    expect(text).toContain('노선 알림')
    expect(text).toContain('준비 중')
    expect(text).toContain('사용 가능')
  })

  it('"~요" 톤으로 작성되어 있다 — "~습니다" 미사용', () => {
    const { container } = render(<NotificationsPage onBack={() => {}} />)
    const text = collectTextContent(container)
    expect(text).not.toMatch(/습니다/)
  })
})
