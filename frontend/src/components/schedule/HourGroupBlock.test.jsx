import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HourGroupBlock from './HourGroupBlock'

const ITEMS = [
  { key: '20:05-0', time: '20:05', isPast: true, isNext: false },
  { key: '20:25-1', time: '20:25', isPast: true, isNext: false },
  { key: '20:45-2', time: '20:45', isPast: true, isNext: false },
]

describe('HourGroupBlock', () => {
  it('시(hour) 라벨과 편수를 함께 렌더한다', () => {
    render(<HourGroupBlock hour="20" items={ITEMS} hasLast={false} />)
    expect(screen.getByText('20시')).toBeTruthy()
    expect(screen.getByText('3편')).toBeTruthy()
  })

  it('막차가 있는 그룹은 "N편 · 막차"로 렌더된다', () => {
    render(<HourGroupBlock hour="22" items={[{ key: '22:10-0', time: '22:10', isLast: true }]} hasLast />)
    expect(screen.getByText('1편 · 막차')).toBeTruthy()
  })

  it('items 개수만큼 시각 칩을 렌더한다', () => {
    render(<HourGroupBlock hour="20" items={ITEMS} hasLast={false} />)
    expect(screen.getByText('20:05')).toBeTruthy()
    expect(screen.getByText('20:25')).toBeTruthy()
    expect(screen.getByText('20:45')).toBeTruthy()
  })

  it('"다음" 항목에 nextRef를 연결한다', () => {
    let ref = null
    const items = [
      { key: '21:00-0', time: '21:00', isPast: true, isNext: false },
      { key: '21:48-1', time: '21:48', isPast: false, isNext: true },
    ]
    render(<HourGroupBlock hour="21" items={items} hasLast={false} nextRef={(el) => { ref = el }} />)
    expect(ref).not.toBeNull()
    expect(ref.textContent).toContain('21:48')
  })
})
