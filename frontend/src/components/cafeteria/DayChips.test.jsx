/**
 * DayChips — "오늘"과 "선택됨"이 독립된 두 신호인지 고정한다.
 *
 * 예전에는 오늘을 알리는 유일한 신호가 "선택된 칩의 배경색"이었다. 다른 요일을
 * 넘겨보는 순간 오늘이 어디였는지 사라져서, 날짜를 이미 아는 사람만 쓸 수 있었다.
 * 칩 마크업이 모바일/PC에 복붙돼 있던 것도 이 컴포넌트로 합쳤다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DayChips from './DayChips'

const ITEMS = [
  { id: '31', label: '31일(월)', hasMenu: true, isToday: false },
  { id: '1', label: '1일(화)', hasMenu: true, isToday: false },
  { id: '2', label: '2일(수)', hasMenu: true, isToday: true },
  { id: '3', label: '3일(목)', hasMenu: true, isToday: false },
  { id: '5', label: '5일(토)', hasMenu: false, isToday: false },
]

describe('DayChips', () => {
  it('항목이 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<DayChips items={[]} value={null} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('모든 요일 칩을 그린다', () => {
    render(<DayChips items={ITEMS} value="2" onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('오늘 칩에는 aria-current="date" 가 붙는다', () => {
    render(<DayChips items={ITEMS} value="2" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /2일\(수\)/ })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /1일\(화\)/ })).not.toHaveAttribute('aria-current')
  })

  // 핵심 회귀: 오늘이 아닌 날을 선택해도 오늘 표시가 남아 있어야 한다.
  it('다른 요일을 선택해도 오늘 표시가 유지된다', () => {
    render(<DayChips items={ITEMS} value="31" onChange={vi.fn()} />)
    const today = screen.getByRole('button', { name: /2일\(수\)/ })
    const selected = screen.getByRole('button', { name: /31일\(월\)/ })
    expect(today).toHaveAttribute('data-today', 'true')
    expect(today).toHaveAttribute('aria-pressed', 'false')
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).not.toHaveAttribute('data-today')
  })

  it('오늘이면서 선택된 칩은 두 속성을 모두 갖는다', () => {
    render(<DayChips items={ITEMS} value="2" onChange={vi.fn()} />)
    const chip = screen.getByRole('button', { name: /2일\(수\)/ })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip).toHaveAttribute('data-today', 'true')
  })

  it('메뉴 없는 날은 흐리게 표시한다', () => {
    render(<DayChips items={ITEMS} value="2" onChange={vi.fn()} />)
    const sat = screen.getByRole('button', { name: /5일\(토\)/ })
    expect(sat).toHaveAttribute('data-has-menu', 'false')
    expect(sat.className).toContain('opacity-40')
  })

  it('모든 칩이 44px 이상 터치 영역을 갖는다', () => {
    render(<DayChips items={ITEMS} value="2" onChange={vi.fn()} />)
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('min-h-[44px]')
    }
  })

  it('칩을 누르면 그 날짜 키로 onChange 가 불린다', () => {
    const onChange = vi.fn()
    render(<DayChips items={ITEMS} value="2" onChange={onChange} />)
    screen.getByRole('button', { name: /3일\(목\)/ }).click()
    expect(onChange).toHaveBeenCalledWith('3')
  })
})
