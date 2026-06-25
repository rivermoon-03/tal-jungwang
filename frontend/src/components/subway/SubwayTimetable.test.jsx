import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SubwayTimetable from './SubwayTimetable'

// useAppStore mock — darkMode: false
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({ darkMode: false }),
}))

const BASE_ENTRIES = [
  { depart_at: '06:00', destination: '오이도' },
  { depart_at: '06:10', destination: '인천' },
  { depart_at: '06:20', destination: '오이도' },
  { depart_at: '06:30', destination: '인천' },
  { depart_at: '23:50', destination: '오이도' },
]

// 현재 시각을 06:05 로 고정: nextIndex=1 (06:10)
beforeEach(() => {
  vi.useFakeTimers()
  const now = new Date()
  now.setHours(6, 5, 0, 0)
  vi.setSystemTime(now)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SubwayTimetable', () => {
  const defaultProps = {
    entries: BASE_ENTRIES,
    nextIndex: 1,
    lastIdx: 4,
    firstIdx: 0,
    lineColor: '#1B5FAD',
    lineDarkColor: '#60a5fa',
    lineLightColor: '#E8F0FB',
  }

  // ── 제거 대상 ──────────────────────────────────────────────────────────

  it('좌측 컬러 바(border-l-N px 바)가 없다', () => {
    const { container } = render(<SubwayTimetable {...defaultProps} />)
    // border-line, border-line-dark 는 허용; border-l-[숫자] / border-l\b 만 금지
    expect(container.innerHTML).not.toMatch(/\bborder-l-\d+|\bborder-l\b/)
  })

  it('이모지가 렌더되지 않는다', () => {
    const { container } = render(<SubwayTimetable {...defaultProps} />)
    expect(/\p{Extended_Pictographic}/u.test(container.textContent)).toBe(false)
  })

  it('막차는 StatusChip 텍스트 "막차"로 렌더된다', () => {
    const { getAllByText } = render(<SubwayTimetable {...defaultProps} />)
    // 막차 텍스트가 존재해야 한다
    expect(getAllByText('막차').length).toBeGreaterThanOrEqual(1)
  })

  it('첫차는 StatusChip 텍스트 "첫차"로 렌더된다', () => {
    const { getAllByText } = render(<SubwayTimetable {...defaultProps} />)
    expect(getAllByText('첫차').length).toBeGreaterThanOrEqual(1)
  })

  // ── 강조 유지 ──────────────────────────────────────────────────────────

  it('다음 열차 행에 bg-accent-bg 틴트가 있다', () => {
    const { container } = render(<SubwayTimetable {...defaultProps} />)
    // nextIndex=1 → "06:10" 행에 bg-accent-bg 클래스가 있어야 한다
    const items = container.querySelectorAll('li')
    // startIdx = max(0, 1-2) = 0 이므로 렌더 순서는 0,1,2,3,4
    // nextIndex=1 이면 di=1 (li[1])
    const nextLi = items[1]
    expect(nextLi.className).toMatch(/bg-accent-bg/)
  })

  it('다음 열차 시각은 font-black(굵게) 렌더된다', () => {
    const { container } = render(<SubwayTimetable {...defaultProps} />)
    const items = container.querySelectorAll('li')
    const nextLi = items[1]
    const timeSpan = nextLi.querySelector('[class*="tabular-nums"]')
    expect(timeSpan).toBeTruthy()
    expect(timeSpan.className).toMatch(/font-black/)
  })

  // ── 과거 열차 ──────────────────────────────────────────────────────────

  it('과거 열차에 opacity 클래스 대신 text-mute 가 적용된다', () => {
    const { container } = render(<SubwayTimetable {...defaultProps} />)
    const items = container.querySelectorAll('li')
    // index 0 (06:00) 은 현재(06:05) 보다 이전 → isPast
    const pastLi = items[0]
    expect(pastLi.className).not.toMatch(/opacity-/)
    // 목적지 span 이 text-mute 클래스
    const mutedSpan = pastLi.querySelector('[class*="text-mute"]')
    expect(mutedSpan).toBeTruthy()
  })

  // ── 글자 크기 ──────────────────────────────────────────────────────────

  it('9~11px 극소 글자(text-[9px]~text-[11px]) 클래스가 없다', () => {
    const { container } = render(<SubwayTimetable {...defaultProps} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:9|10|11)px\]/)
  })

  // ── 회귀: props 계약 ───────────────────────────────────────────────────

  it('entries가 빈 배열이면 아무 행도 렌더하지 않는다', () => {
    const { container } = render(
      <SubwayTimetable {...defaultProps} entries={[]} nextIndex={-1} lastIdx={null} firstIdx={null} />
    )
    expect(container.querySelectorAll('li').length).toBe(0)
  })

  it('depart_at 시각 텍스트가 렌더된다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    expect(screen.getByText('06:10')).toBeTruthy()
  })
})
