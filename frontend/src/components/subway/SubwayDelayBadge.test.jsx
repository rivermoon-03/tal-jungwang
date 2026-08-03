/**
 * SubwayDelayBadge — 지연 배지 + 근거 팝오버 테스트.
 *
 * 핵심 단언:
 *  1. minutes 없으면 렌더하지 않음 (배지는 지연 중일 때만)
 *  2. 칩이 delayed 토큰(bg-delayed-bg / text-delayed)을 사용
 *  3. 탭하면 role="dialog" 팝오버 — 제목/근거 행/베타 캡션
 *  4. Esc·바깥 탭으로 닫힘, aria-expanded/aria-controls 접근성
 *  5. 12px 미만 글자 클래스 미사용
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SubwayDelayBadge from './SubwayDelayBadge'

const PROPS = {
  direction: '상행',
  minutes: 7,
  since: '2026-05-18T08:02:00+09:00',
  samples: [6.0, 7.0, 8.5],
}

describe('SubwayDelayBadge — 렌더 조건', () => {
  it('minutes 가 null 이면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<SubwayDelayBadge {...PROPS} minutes={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('지연 중이면 "지연 약 +7분" 칩이 렌더된다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    expect(screen.getByText('지연 약 +7분')).toBeTruthy()
  })

  it('칩이 delayed semantic 토큰을 사용한다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-delayed-bg')
    expect(btn.className).toContain('text-delayed')
  })
})

describe('SubwayDelayBadge — 팝오버', () => {
  it('탭하면 role="dialog" 팝오버가 열리고 제목이 "{방향} 지연 감지"다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    fireEvent.click(screen.getByRole('button'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByText('상행 지연 감지')).toBeTruthy()
  })

  it('근거 행 — 최근 도착 편차 범위(6~9분)와 감지 시각(08:02부터)이 보인다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/시간표보다 6~9분 늦음/)).toBeTruthy()
    expect(screen.getByText(/08:02부터/)).toBeTruthy()
  })

  it('샘플이 모두 같으면 "약 N분" 으로 표기한다', () => {
    render(<SubwayDelayBadge {...PROPS} samples={[7.0, 7.0, 7.0]} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/시간표보다 약 7분 늦음/)).toBeTruthy()
  })

  it('하단에 베타·자체 감지 캡션이 있다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/베타 · 자체 감지/)).toBeTruthy()
    expect(screen.getByText(/해소되면 배지가 자동으로 사라져요/)).toBeTruthy()
  })

  it('Esc 로 닫힌다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('바깥 pointerdown 으로 닫힌다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('SubwayDelayBadge — 접근성', () => {
  it('aria-expanded 가 열림 상태를 반영하고 aria-controls 가 dialog 를 가리킨다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(btn.getAttribute('aria-controls')).toBe(screen.getByRole('dialog').id)
  })

  it('버튼 aria-label 에 방향과 지연 분이 담긴다', () => {
    render(<SubwayDelayBadge {...PROPS} />)
    expect(
      screen.getByRole('button', { name: /상행 지연 약 7분 감지/ })
    ).toBeTruthy()
  })
})

describe('SubwayDelayBadge — 토큰 준수', () => {
  it('12px 미만 글자 클래스(text-[8~11px])가 없다', () => {
    const { container } = render(<SubwayDelayBadge {...PROPS} />)
    fireEvent.click(screen.getByRole('button'))
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })
})
