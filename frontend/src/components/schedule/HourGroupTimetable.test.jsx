import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HourGroupTimetable from './HourGroupTimetable'

// 시안 예시 그대로: 20시 3편(전부 과거) / 21시 3편(21:48만 다음) / 22시 2편(막차)
const ITEMS = [
  { key: '20:05-0', time: '20:05', isPast: true, isNext: false, isLast: false },
  { key: '20:25-1', time: '20:25', isPast: true, isNext: false, isLast: false },
  { key: '20:45-2', time: '20:45', isPast: true, isNext: false, isLast: false },
  { key: '21:00-3', time: '21:00', isPast: true, isNext: false, isLast: false },
  { key: '21:20-4', time: '21:20', isPast: true, isNext: false, isLast: false },
  { key: '21:48-5', time: '21:48', isPast: false, isNext: true, isLast: false },
  { key: '22:10-6', time: '22:10', isPast: false, isNext: false, isLast: false },
  { key: '22:40-7', time: '22:40', isPast: false, isNext: false, isLast: true },
]

describe('HourGroupTimetable', () => {
  it('시(hour) 단위로 그룹을 나눠 렌더한다', () => {
    render(<HourGroupTimetable items={ITEMS} now={new Date(2026, 8, 1, 21, 45)} />)
    expect(screen.getByText('20시')).toBeTruthy()
    expect(screen.getByText('21시')).toBeTruthy()
    expect(screen.getByText('22시')).toBeTruthy()
  })

  it('막차가 속한 22시 그룹은 "2편 · 막차"로 렌더된다', () => {
    render(<HourGroupTimetable items={ITEMS} now={new Date(2026, 8, 1, 21, 45)} />)
    expect(screen.getByText('2편 · 막차')).toBeTruthy()
  })

  it('"다음" 항목(21:48)이 속한 21시 그룹 바로 뒤에 "지금" 앵커를 끼워 넣는다', () => {
    render(<HourGroupTimetable items={ITEMS} now={new Date(2026, 8, 1, 21, 45)} />)
    const anchor = screen.getByTestId('now-anchor-line')
    expect(anchor.textContent).toContain('지금 21:45')
    expect(anchor.textContent).toContain('다음 3분')

    // 22시 그룹 헤더보다 앵커가 DOM 순서상 앞선다(21시 그룹 뒤에 끼워짐).
    const hour22 = screen.getByText('22시')
    expect(
      anchor.compareDocumentPosition(hour22) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('오늘 운행이 모두 끝났으면(다음 항목 없음) "지금" 앵커를 렌더하지 않는다', () => {
    const allPast = ITEMS.map((it) => ({ ...it, isNext: false, isPast: true }))
    render(<HourGroupTimetable items={allPast} now={new Date(2026, 8, 1, 23, 0)} />)
    expect(screen.queryByTestId('now-anchor-line')).toBeNull()
  })

  it('"다음" 항목이 그룹 중간에 있으면 그 항목 바로 앞에 앵커를 끼워 넣는다(결함 4)', () => {
    // 19시 그룹이 19:05 19:15 19:30 19:45로 그려지고 19:45가 다음 차일 때,
    // 옛 구현은 19시 그룹이 통째로 끝난 뒤(=19:45 바로 뒤)에 앵커를 넣어
    // 19:45가 앵커보다 위(과거 쪽)에 그려지는 결함이 있었다. 이제는 19:45
    // 바로 앞(19:30과 19:45 사이)에 앵커가 와야 한다.
    const items = [
      { key: '19:05-0', time: '19:05', isPast: true, isNext: false, isLast: false },
      { key: '19:15-1', time: '19:15', isPast: true, isNext: false, isLast: false },
      { key: '19:30-2', time: '19:30', isPast: true, isNext: false, isLast: false },
      { key: '19:45-3', time: '19:45', isPast: false, isNext: true, isLast: false },
    ]
    render(<HourGroupTimetable items={items} now={new Date(2026, 8, 1, 19, 32)} />)
    const anchor = screen.getByTestId('now-anchor-line')
    const chip1930 = screen.getByText('19:30')
    const chip1945 = screen.getByText('19:45')

    // 19:30은 앵커보다 앞(과거 쪽), 19:45는 앵커보다 뒤(미래 쪽)에 그려진다.
    expect(chip1930.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(anchor.compareDocumentPosition(chip1945) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // 시(hour) 헤더는 하나만 렌더된다(그룹이 쪼개져도 "19시"가 중복되지 않는다).
    expect(screen.getAllByText('19시')).toHaveLength(1)
  })

  it('"다음" 항목이 그룹의 첫 항목이면(첫차 전) 그룹 앞에 앵커를 놓는다', () => {
    const items = [
      { key: '07:00-0', time: '07:00', isPast: false, isNext: true, isLast: false },
      { key: '07:20-1', time: '07:20', isPast: false, isNext: false, isLast: false },
    ]
    render(<HourGroupTimetable items={items} now={new Date(2026, 8, 1, 6, 50)} />)
    const anchor = screen.getByTestId('now-anchor-line')
    const hour07 = screen.getByText('07시')
    expect(anchor.compareDocumentPosition(hour07) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('nextRef를 "다음" 칩에 연결한다', () => {
    let ref = null
    render(
      <HourGroupTimetable
        items={ITEMS}
        now={new Date(2026, 8, 1, 21, 45)}
        nextRef={(el) => { ref = el }}
      />
    )
    expect(ref).not.toBeNull()
    expect(ref.textContent).toContain('21:48')
  })
})
