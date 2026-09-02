/**
 * GlobalSubwayDetailSheet — 시안1 리디자인(시간표 우선 + 실시간 60초 freshness)
 *
 * TDD: 구현 전 FAIL → 구현 후 PASS
 *
 * 핵심 단언:
 *   1. bg-red-500 / bg-amber- / text-amber- 하드코딩 색 미사용
 *   2. text-[10px] / text-[9px] / text-[11px] 극소 글자 미사용
 *   3. text-slate- 하드코딩 색 미사용
 *   4. 막차 칩이 StatusChip(span.rounded-full) 구조 (fresh 실시간 데이터 기반)
 *   5. "없습니다" 카피가 없음 (→ "없어요")
 *   6. isRealtimeFresh: 60초 이내=true, 초과=false, stale=false, null=false
 *   7. 시간표 섹션이 렌더됨 (trains 있을 때)
 *   8. 실시간 영역은 fresh일 때만 렌더됨 (data-testid="realtime-section")
 *   9. stale / null이면 실시간 영역 숨김
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// jsdom에 window.matchMedia 없어서 stub 필요
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ──────────────────────────────────────────────────────────
// freshness 헬퍼 단위 테스트 (named export, mock 없이 직접)
// ──────────────────────────────────────────────────────────
import { isRealtimeFresh } from './realtimeFreshness'

describe('isRealtimeFresh — 60초 이내 freshness 판정', () => {
  it('현재 시각 기준 30초 전 타임스탬프 → true', () => {
    const ts = new Date(Date.now() - 30_000).toISOString()
    expect(isRealtimeFresh(ts, false)).toBe(true)
  })

  it('현재 시각 기준 59초 전 타임스탬프 → true', () => {
    const ts = new Date(Date.now() - 59_000).toISOString()
    expect(isRealtimeFresh(ts, false)).toBe(true)
  })

  it('현재 시각 기준 60초 전 타임스탬프 → false (경계)', () => {
    const ts = new Date(Date.now() - 60_000).toISOString()
    expect(isRealtimeFresh(ts, false)).toBe(false)
  })

  it('현재 시각 기준 120초 전 타임스탬프 → false', () => {
    const ts = new Date(Date.now() - 120_000).toISOString()
    expect(isRealtimeFresh(ts, false)).toBe(false)
  })

  it('타임스탬프가 null → false', () => {
    expect(isRealtimeFresh(null, false)).toBe(false)
  })

  it('타임스탬프가 undefined → false', () => {
    expect(isRealtimeFresh(undefined, false)).toBe(false)
  })

  it('타임스탬프가 빈 문자열 → false', () => {
    expect(isRealtimeFresh('', false)).toBe(false)
  })

  it('stale=true이면 타임스탬프가 최신이어도 → false', () => {
    const ts = new Date(Date.now() - 10_000).toISOString()
    expect(isRealtimeFresh(ts, true)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────
// 렌더 테스트: mock은 "stale·null" 기본값 (실시간 없음)
// ──────────────────────────────────────────────────────────

// 기본 store mock (실시간 없음 상황)
const BASE_SHEET = {
  station: '정왕',
  lineName: '수인분당선',
  direction: '상행',
  color: '#F5A623',
  darkColor: '#D4891E',
  lightColor: '#FFF3DC',
  timetableKey: 'test_key',
  realtimeTrain: null,
}

const closeSubwayDetailSheet = vi.fn()

// scheduleViewMode 는 테스트마다 바꿔야 해서 mutable 로 둔다(vi.mock 팩토리는
// 호이스팅되므로 vi.hoisted 로 초기화 순서를 보장한다).
const storeState = vi.hoisted(() => ({ scheduleViewMode: 'list' }))

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      subwayDetailSheet: BASE_SHEET,
      closeSubwayDetailSheet,
      setSubwayLineSheet: vi.fn(),
      scheduleViewMode: storeState.scheduleViewMode,
    }),
}))

// 기본 hook mock: 실시간 null, timetable에 test_key 포함
vi.mock('../../hooks/useSubway', () => ({
  useSubwayTimetable: () => ({
    data: {
      test_key: [
        { depart_at: '05:32', destination: '당고개' },
        { depart_at: '06:10', destination: '당고개' },
        { depart_at: '23:45', destination: '당고개' },
      ],
    },
    loading: false,
  }),
  useSubwayRealtime: () => ({ data: null, loading: false, refetch: vi.fn() }),
  normalizeRealtimeStation: () => ({ items: [], stale: false, lastSuccessfulRealtimeAt: null }),
}))

vi.mock('../../hooks/useSecondsCountdown', () => ({
  useSecondsCountdown: () => ({ secondsLeft: 120, progress: 0.5 }),
}))

vi.mock('../../utils/trainTime', () => ({
  getSpecialTrainIndices: () => ({ lastIdx: 2, firstIdx: 0 }),
}))

vi.mock('./SubwayCountdown', () => ({
  default: () => null,
}))

// 혼잡 차트는 자체 테스트(SubwayCrowdingChart.test.jsx)에서 검증 — 여기선
// 네트워크(useApi) 격리를 위해 미렌더 상태(데이터 없음)로 고정한다.
vi.mock('./SubwayCrowdingChart', () => ({
  default: () => null,
}))

import GlobalSubwayDetailSheet from './GlobalSubwayDetailSheet'

// ══════════════════════════════════════════════════════════════════════════════
describe('GlobalSubwayDetailSheet — 하드코딩 색 제거', () => {
  it('bg-red-500 클래스가 HTML 어디에도 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.innerHTML).not.toMatch(/bg-red-500/)
  })

  it('bg-amber- 클래스가 HTML 어디에도 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.innerHTML).not.toMatch(/bg-amber-/)
  })

  it('text-amber- 클래스가 HTML 어디에도 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.innerHTML).not.toMatch(/text-amber-/)
  })

  it('text-[10px] / text-[9px] / text-[11px] 극소 글자가 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:9|10|11)px\]/)
  })

  it('text-slate- 하드코딩 색이 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.innerHTML).not.toMatch(/text-slate-/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GlobalSubwayDetailSheet — "~요" 카피', () => {
  it('"없습니다" 텍스트가 노출되지 않는다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.textContent).not.toMatch(/없습니다/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GlobalSubwayDetailSheet — 시간표 우선 레이아웃', () => {
  it('trains 데이터가 있으면 timetable-grid-section이 렌더된다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.querySelector('[data-testid="timetable-grid-section"]')).toBeTruthy()
  })

  it('첫차/막차 요약 영역이 렌더된다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.textContent).toMatch(/첫차/)
    expect(container.textContent).toMatch(/막차/)
  })

  it('요일 탭(평일/토요일/일요일)이 렌더된다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.textContent).toMatch(/평일/)
    expect(container.textContent).toMatch(/토요일/)
    expect(container.textContent).toMatch(/일요일/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GlobalSubwayDetailSheet — 실시간 섹션 조건부 표시', () => {
  it('lastSuccessfulRealtimeAt=null이면 realtime-section이 없다', () => {
    // 기본 mock이 null을 반환하므로 realtime-section이 없어야 함
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.querySelector('[data-testid="realtime-section"]')).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GlobalSubwayDetailSheet — 막차 칩 (시간표 기반)', () => {
  it('막차 칩에 bg-red-500이 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '막차',
    )
    chips.forEach((chip) => {
      expect(chip.className).not.toMatch(/bg-red-/)
    })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 모바일 경로가 ui/Sheet로 이관됐는지 회귀 검증. 예전엔 이 시트만 자체 딤
// 배경(z-[90])을 그리면서 Escape 핸들러가 아예 없었다.
describe('GlobalSubwayDetailSheet — Sheet 이관(Escape·백드롭·포커스 트랩)', () => {
  beforeEach(() => {
    closeSubwayDetailSheet.mockClear()
  })

  it('dialog role로 렌더링된다', () => {
    render(<GlobalSubwayDetailSheet />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Escape를 누르면 closeSubwayDetailSheet가 호출된다', () => {
    render(<GlobalSubwayDetailSheet />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeSubwayDetailSheet).toHaveBeenCalledTimes(1)
  })

  it('백드롭을 클릭하면 닫힌다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(closeSubwayDetailSheet).toHaveBeenCalledTimes(1)
  })

  it('시트 안에서 Tab 포커스가 바깥으로 새지 않는다(포커스 트랩)', () => {
    render(<GlobalSubwayDetailSheet />)
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    expect(focusable.length).toBeGreaterThan(0)
    const last = focusable[focusable.length - 1]
    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(focusable[0])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
/**
 * 같은 지하철 시간표가 진입 경로에 따라 다른 모양으로 보이면 안 된다.
 * ScheduleDetailModal 은 scheduleViewMode 를 읽어 시(hour) 그룹 리스트와 4열
 * 그리드를 전환하는데, 이 시트만 그리드로 고정돼 있었다. 두 화면이 같은
 * persist 값을 따르는지 고정한다.
 */
describe('GlobalSubwayDetailSheet — scheduleViewMode 연동', () => {
  beforeEach(() => {
    storeState.scheduleViewMode = 'list'
  })

  it('list 모드에서는 시(hour) 그룹 헤더가 보인다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    // mock 시간표가 05:32 / 06:10 / 23:45 이라 05·06·23시 그룹이 생긴다.
    expect(container.textContent).toMatch(/05시/)
    expect(container.textContent).toMatch(/23시/)
  })

  it('list 모드에서는 행선지 서브라벨이 붙는다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.textContent).toMatch(/당고개행/)
  })

  it('grid 모드에서는 4열 그리드로 돌아가고 시 그룹 헤더가 없다', () => {
    storeState.scheduleViewMode = 'grid'
    const { container } = render(<GlobalSubwayDetailSheet />)
    const section = container.querySelector('[data-testid="timetable-grid-section"]')
    expect(section.querySelector('.grid-cols-4')).toBeTruthy()
    expect(section.textContent).not.toMatch(/05시/)
  })

  it('두 모드 모두 시간표 자체는 렌더된다', () => {
    for (const mode of ['list', 'grid']) {
      storeState.scheduleViewMode = mode
      const { container, unmount } = render(<GlobalSubwayDetailSheet />)
      expect(container.textContent).toMatch(/05:32/)
      expect(container.textContent).toMatch(/23:45/)
      unmount()
    }
  })
})
