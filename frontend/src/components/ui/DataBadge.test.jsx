import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DataBadge from './DataBadge'

describe('DataBadge', () => {
  it('live 상태: "실시간" 라벨과 펄스 점을 렌더한다', () => {
    const { container } = render(<DataBadge state="live" />)
    expect(screen.getByText('실시간')).toBeTruthy()
    expect(container.querySelector('.animate-dot-blink')).toBeTruthy()
  })

  it('timetable 상태: "시간표" 라벨을 렌더하고 펄스 점은 없다', () => {
    const { container } = render(<DataBadge state="timetable" />)
    expect(screen.getByText('시간표')).toBeTruthy()
    expect(container.querySelector('.animate-dot-blink')).toBeFalsy()
  })

  it('stale 상태: staleAgeText가 없으면 "지연 갱신"으로 폴백한다', () => {
    render(<DataBadge state="stale" />)
    expect(screen.getByText('지연 갱신')).toBeTruthy()
  })

  it('stale 상태: staleAgeText가 있으면 해당 텍스트를 라벨로 쓴다', () => {
    render(<DataBadge state="stale" staleAgeText="2분 전 정보" />)
    expect(screen.getByText('2분 전 정보')).toBeTruthy()
    expect(screen.queryByText('지연 갱신')).toBeNull()
  })

  it('reduced-motion: 애니메이션이 인라인 style이 아니라 tailwind 클래스로 제어되어 전역 규칙을 따른다', () => {
    const { container } = render(<DataBadge state="live" />)
    const dot = container.querySelector('.animate-dot-blink')
    expect(dot.getAttribute('style')).toBeNull()
  })

  it('compact: 라벨 텍스트는 숨기되 sr-only 접근성 라벨은 유지한다', () => {
    const { container } = render(<DataBadge state="live" compact />)
    const srOnly = container.querySelector('.sr-only')
    expect(srOnly?.textContent).toBe('실시간')
  })

  it('기본(non-compact) 배지는 StatusChip과 동일한 rounded-full span 구조다', () => {
    const { container } = render(<DataBadge state="live" />)
    expect(container.querySelector('span.rounded-full')).toBeTruthy()
  })

  it('알 수 없는 state는 timetable로 폴백한다', () => {
    render(<DataBadge state="unknown" />)
    expect(screen.getByText('시간표')).toBeTruthy()
  })
})
