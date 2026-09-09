/**
 * Skeleton — 레이아웃 시프트 0 검증 (F1-4)
 *
 * 픽셀 단위 정합은 확인하지 않는다. 대신 스켈레톤 변형이 대응하는 실제 카드와
 * 높이를 결정하는 컨테이너 클래스(rounded-card, p-[18px])를 공유하는지, 그리고
 * 실제 카드와 같은 수의 "행"(좌/중/우 또는 헤더+듀얼 컬럼)을 구성하는지만 본다.
 */
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Skeleton, { SkeletonArrivalCard, SkeletonPanelRow } from './Skeleton'
import TransitCard from '../ui/TransitCard'

describe('Skeleton — 기본 shimmer 블록', () => {
  it('tj-skeleton 클래스와 aria-hidden을 갖는다', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild
    expect(el).toHaveClass('tj-skeleton')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SkeletonArrivalCard — TransitCard와 셸 클래스 공유', () => {
  it('실제 카드와 같은 셸(rounded-card p-3 shadow-sh-card)을 쓴다', () => {
    const { container: real } = render(
      <TransitCard
        badge={{ label: '5602' }}
        title="이마트"
        eta={{ primary: { text: '5분' } }}
      />
    )
    const { container: skel } = render(<SkeletonArrivalCard />)

    const realCard = real.firstChild
    const skelCard = skel.firstChild
    // 스켈레톤이 실제 카드와 같은 패딩·모서리를 써야 로딩에서 결과로 넘어갈 때
    // 레이아웃이 튀지 않는다. TransitCard 셸이 바뀌면 여기서 잡힌다.
    for (const cls of ['rounded-card', 'p-3', 'bg-surface', 'shadow-sh-card']) {
      expect(realCard.className).toContain(cls)
      expect(skelCard.className).toContain(cls)
    }
  })

  it('좌(타일) · 중앙(제목 2줄) · 우(숫자) 3분할 그리드 구조를 갖는다', () => {
    const { container } = render(<SkeletonArrivalCard />)
    const row = container.querySelector('.grid')
    expect(row).not.toBeNull()
    expect(row.className).toContain('grid-cols-[auto_1fr_auto]')
    expect(row.children.length).toBe(3)
    expect(row.children[1].children.length).toBe(2)
  })

  it('aria-hidden으로 접근성 트리에서 제외된다', () => {
    const { container } = render(<SkeletonArrivalCard />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

// DualDirectionCard(좌우 듀얼 컬럼 카드)는 TransitCard로 대체되며 삭제됐다(결함
// #4, 2026-08). SubwayPanel/ShuttlePanel은 여전히 로딩 중 이 듀얼 컬럼 모양의
// 스켈레톤을 쓰므로 SkeletonPanelRow 자체의 구조 검증만 남긴다.
describe('SkeletonPanelRow — 듀얼 컬럼 로딩 스켈레톤', () => {
  it('rounded-card / p-[18px] 박스를 갖는다', () => {
    const { container: skel } = render(<SkeletonPanelRow />)
    const skelCard = skel.querySelector('.rounded-card')
    expect(skelCard).not.toBeNull()
    expect(skelCard.className).toContain('p-[18px]')
  })

  it('헤더(심볼+노선명) + 좌우 듀얼 컬럼(grid-cols-[1fr_1px_1fr]) 구조를 갖는다', () => {
    const { container } = render(<SkeletonPanelRow />)
    const grid = container.querySelector('.grid')
    expect(grid).not.toBeNull()
    expect(grid.className).toMatch(/grid-cols-\[1fr_1px_1fr\]/)
    // 좌 컬럼 / 구분선 / 우 컬럼 — 3개
    expect(grid.children.length).toBe(3)
  })

  it('aria-hidden으로 접근성 트리에서 제외된다', () => {
    const { container } = render(<SkeletonPanelRow />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
