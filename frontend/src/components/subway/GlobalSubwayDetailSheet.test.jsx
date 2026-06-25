/**
 * GlobalSubwayDetailSheet — AI티(하드코딩 색/극소 글자) 제거 검증
 *
 * TDD: 구현 전 먼저 FAIL 확인 후 수정.
 * 핵심 단언:
 *   1. bg-red-500 (막차 배경) 미사용
 *   2. bg-amber-100 / bg-amber-900 (stale 배경) 미사용
 *   3. text-[10px] / text-[9px] / text-[11px] 극소 글자 미사용
 *   4. text-slate- 하드코딩 색 미사용
 *   5. 막차 칩이 StatusChip(span.rounded-full) 구조
 *   6. "없습니다" 카피가 없음 (→ "없어요" 로 변경)
 */
import { render, screen } from '@testing-library/react'
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

// 최소 stub: GlobalSubwayDetailSheet는 store·hook에 깊게 의존하므로 mock 처리
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      subwayDetailSheet: {
        station: '정왕',
        lineName: '수인분당선',
        direction: '상행',
        color: '#F5A623',
        darkColor: '#D4891E',
        lightColor: '#FFF3DC',
        timetableKey: 'test_key',
        realtimeTrain: {
          train_no: 'T001',
          destination: '오이도',
          is_last_train: true,
          arrive_seconds: 180,
          status_code: null,
          status_msg: '정왕 출발',
          location_msg: null,
          smart_status: null,
          current_station: '정왕',
          recptn_dt: null,
          ordkey: null,
        },
      },
      closeSubwayDetailSheet: vi.fn(),
      setSubwayLineSheet: vi.fn(),
    }),
}))

vi.mock('../../hooks/useSubway', () => ({
  useSubwayTimetable: () => ({ data: null, loading: false }),
  useSubwayRealtime: () => ({ data: null, loading: false, refetch: vi.fn() }),
  normalizeRealtimeStation: () => ({ items: [], lastSuccessfulRealtimeAt: null }),
}))

vi.mock('../../hooks/useSecondsCountdown', () => ({
  useSecondsCountdown: () => ({ secondsLeft: 120, progress: 0.5 }),
}))

vi.mock('../../utils/trainTime', () => ({
  getSpecialTrainIndices: () => ({ lastIdx: null, firstIdx: null }),
}))

vi.mock('./SubwayCountdown', () => ({
  default: () => null,
}))

vi.mock('./SubwayTimetable', () => ({
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
describe('GlobalSubwayDetailSheet — 막차 StatusChip', () => {
  it('막차 칩이 span.rounded-full 구조(StatusChip)로 렌더된다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    const chip = [...container.querySelectorAll('span')].find(
      (el) => el.textContent.trim() === '막차' && el.className.includes('rounded-full'),
    )
    expect(chip).toBeTruthy()
  })

  it('막차 칩에 bg-red-500이 없다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    const chip = [...container.querySelectorAll('span')].find(
      (el) => el.textContent.trim() === '막차',
    )
    expect(chip?.className ?? '').not.toMatch(/bg-red-/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GlobalSubwayDetailSheet — "~요" 카피', () => {
  it('"없습니다" 텍스트가 노출되지 않는다', () => {
    const { container } = render(<GlobalSubwayDetailSheet />)
    expect(container.textContent).not.toMatch(/없습니다/)
  })
})
