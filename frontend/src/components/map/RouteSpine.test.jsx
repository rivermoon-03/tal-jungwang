/**
 * RouteSpine — 토큰 정리 검증 테스트
 * TDD: 구현 전 FAIL → 토큰화 후 PASS
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RouteSpine from './RouteSpine'

describe('RouteSpine — 8~11px 극소 글자 미사용', () => {
  it('text-[9px]/[10px]/[11px] 클래스가 없어야 한다', () => {
    const { container } = render(
      <RouteSpine leftLabel="시화" rightLabel="강남" activeSide="right" />
    )
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })
})

describe('RouteSpine — slate/gray 하드코딩 색 미사용', () => {
  it('text-slate- / text-gray- 클래스가 없어야 한다', () => {
    const { container } = render(
      <RouteSpine leftLabel="시화" rightLabel="강남" activeSide="right" />
    )
    expect(container.innerHTML).not.toMatch(/text-slate-/)
    expect(container.innerHTML).not.toMatch(/text-gray-/)
  })
})

describe('RouteSpine — 핵심 렌더', () => {
  it('leftLabel, rightLabel 이 렌더된다', () => {
    render(<RouteSpine leftLabel="시화" rightLabel="강남" activeSide="right" />)
    expect(screen.getByText('시화')).toBeTruthy()
    expect(screen.getByText('강남')).toBeTruthy()
  })

  it('activeSide=left 이면 화살표가 ← 방향이다', () => {
    const { container } = render(
      <RouteSpine leftLabel="시화" rightLabel="강남" activeSide="left" />
    )
    expect(container.textContent).toContain('←')
  })

  it('activeSide=right 이면 화살표가 → 방향이다', () => {
    const { container } = render(
      <RouteSpine leftLabel="시화" rightLabel="강남" activeSide="right" />
    )
    expect(container.textContent).toContain('→')
  })
})
