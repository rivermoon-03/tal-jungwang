import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  // jsdom에는 scrollIntoView가 구현되어 있지 않다 — 호출 자체만 검증한다.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SubwayTimetable — 시(hour) 그룹 시간표(시안)', () => {
  const defaultProps = {
    entries: BASE_ENTRIES,
    nextIndex: 1,
    lastIdx: 4,
  }

  it('시(hour) 헤더가 "06시"/"23시"로 렌더되고 편수를 함께 보여준다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    expect(screen.getByText('06시')).toBeTruthy()
    expect(screen.getByText('23시')).toBeTruthy()
    // 06시 그룹은 4편(00/10/20/30), 막차 없음
    expect(screen.getByText('4편')).toBeTruthy()
  })

  it('막차가 속한 시(hour) 그룹 헤더는 "1편 · 막차"로 렌더된다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    expect(screen.getByText('1편 · 막차')).toBeTruthy()
  })

  it('각 시각 칩에 행선지가 부제로 붙는다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    expect(screen.getAllByText('오이도행').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('인천행').length).toBeGreaterThanOrEqual(1)
  })

  it('다음 열차(06:10) 칩은 accent 배경으로 채워진다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    const chip = screen.getByText('06:10').closest('.rounded-tile')
    expect(chip.className).toMatch(/bg-accent\b/)
  })

  it('지난 열차(06:00) 칩은 흐리게(opacity-40) 렌더된다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    const chip = screen.getByText('06:00').closest('.rounded-tile')
    expect(chip.className).toMatch(/opacity-40/)
  })

  it('"지금" 앵커가 현재 시각과 다음 열차까지 남은 시간을 보여준다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    expect(screen.getByText('지금 06:05 · 다음 5분')).toBeTruthy()
  })

  it('마운트 시 다음 열차 칩으로 스크롤한다', () => {
    render(<SubwayTimetable {...defaultProps} />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center', behavior: 'smooth' })
    )
  })

  it('entries가 빈 배열이면 아무 시각도 렌더하지 않는다', () => {
    render(<SubwayTimetable entries={[]} nextIndex={-1} lastIdx={null} />)
    expect(screen.queryByText(/시$/)).toBeNull()
  })

  it('오늘 운행이 모두 끝났으면(nextIndex=-1) "지금" 앵커를 숨긴다', () => {
    render(<SubwayTimetable entries={BASE_ENTRIES} nextIndex={-1} lastIdx={4} />)
    expect(screen.queryByText(/^지금 /)).toBeNull()
  })
})
