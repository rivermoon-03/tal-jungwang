/**
 * StatsSheet — Sheet.jsx 머리말이 "손으로 복사한 같은 코드"로 지목한 시트 중
 * 하나였다(자체 백드롭 + Escape 핸들러). ui/Sheet로 옮긴 뒤 Escape·백드롭·
 * 포커스 트랩이 그대로 동작하는지 검증한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../stats/StatusChips', () => ({ default: () => <div>status-chips</div> }))
vi.mock('../stats/TrafficFlowCard', () => ({ default: () => <div>traffic-flow</div> }))
vi.mock('../stats/CrowdingCard', () => ({ default: () => <div>crowding</div> }))
vi.mock('../stats/WeatherCard', () => ({ default: () => <div>weather</div> }))

let isDesktop = false
vi.mock('../../hooks/useMediaQuery', () => ({
  useIsDesktop: () => isDesktop,
}))

import StatsSheet from './StatsSheet'

beforeEach(() => {
  isDesktop = false
})

describe('StatsSheet — 닫힘 상태', () => {
  it('open=false면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<StatsSheet open={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('StatsSheet — 열림 상태(ui/Sheet)', () => {
  it('dialog role로 렌더링되고 자식 카드들을 보여준다', () => {
    render(<StatsSheet open onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: '오늘의 교통 통계' })).toBeInTheDocument()
    expect(screen.getByText('status-chips')).toBeInTheDocument()
    expect(screen.getByText('traffic-flow')).toBeInTheDocument()
    expect(screen.getByText('crowding')).toBeInTheDocument()
    expect(screen.getByText('weather')).toBeInTheDocument()
  })

  it('Escape를 누르면 onClose가 호출된다', () => {
    const onClose = vi.fn()
    render(<StatsSheet open onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('백드롭을 클릭하면 onClose가 호출된다', () => {
    const onClose = vi.fn()
    const { container } = render(<StatsSheet open onClose={onClose} />)
    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('닫기 버튼이 IconButton(44px 히트 영역)이다', () => {
    render(<StatsSheet open onClose={() => {}} />)
    const closeBtn = screen.getByRole('button', { name: '닫기' })
    expect(closeBtn.className).toMatch(/min-h-\[44px\]/)
  })

  it('시트 안에서 Tab 포커스가 바깥으로 새지 않는다(포커스 트랩)', () => {
    render(<StatsSheet open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    expect(focusable.length).toBeGreaterThan(0)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('모바일은 bottom 배치(하단 시트), PC는 center 배치로 바뀐다', () => {
    const { container: mobile } = render(<StatsSheet open onClose={() => {}} />)
    expect(mobile.querySelector('.inset-x-0.bottom-0')).toBeTruthy()

    isDesktop = true
    const { container: desktop } = render(<StatsSheet open onClose={() => {}} />)
    expect(desktop.querySelector('.left-1\\/2.top-1\\/2')).toBeTruthy()
  })
})
