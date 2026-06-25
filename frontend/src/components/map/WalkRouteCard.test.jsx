/**
 * WalkRouteCard — 토큰 정리 검증 테스트
 * TDD: 구현 전 FAIL → 토큰화 후 PASS
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WalkRouteCard from './WalkRouteCard'

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      walkRoute: {
        destName: '정왕역',
        durationSec: 300,
        distanceM: 400,
      },
      clearWalkRoute: vi.fn(),
    }),
}))

describe('WalkRouteCard — 8~11px 극소 글자 미사용', () => {
  it('text-[9px]/[10px]/[11px] 클래스가 없어야 한다', () => {
    const { container } = render(<WalkRouteCard />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })
})

describe('WalkRouteCard — slate/gray 하드코딩 색 미사용', () => {
  it('text-slate- / text-gray- 클래스가 없어야 한다', () => {
    const { container } = render(<WalkRouteCard />)
    expect(container.innerHTML).not.toMatch(/text-slate-/)
    expect(container.innerHTML).not.toMatch(/text-gray-/)
  })

  it('bg-slate- 클래스가 없어야 한다', () => {
    const { container } = render(<WalkRouteCard />)
    expect(container.innerHTML).not.toMatch(/bg-slate-/)
  })
})

describe('WalkRouteCard — 핵심 렌더', () => {
  it('목적지 이름이 렌더된다', () => {
    render(<WalkRouteCard />)
    expect(screen.getByText(/정왕역/)).toBeTruthy()
  })

  it('도보 소요 시간이 렌더된다', () => {
    render(<WalkRouteCard />)
    expect(screen.getByText(/5분/)).toBeTruthy()
  })

  it('거리 정보가 렌더된다', () => {
    render(<WalkRouteCard />)
    expect(screen.getByText(/400m/)).toBeTruthy()
  })

  it('닫기 버튼이 렌더된다', () => {
    render(<WalkRouteCard />)
    expect(screen.getByRole('button', { name: '경로 닫기' })).toBeTruthy()
  })
})
