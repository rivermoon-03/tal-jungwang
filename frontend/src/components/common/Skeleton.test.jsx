/**
 * Skeleton — 레이아웃 시프트 0 검증 (F1-4)
 *
 * 픽셀 단위 정합은 확인하지 않는다. 대신 스켈레톤 변형이 대응하는 실제 카드와
 * 높이를 결정하는 컨테이너 클래스(rounded-card, p-4)를 공유하는지, 그리고
 * 실제 카드와 같은 수의 "행"(좌/중/우 또는 헤더+듀얼 컬럼)을 구성하는지만 본다.
 */
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Skeleton, { SkeletonArrivalCard, SkeletonPanelRow } from './Skeleton'
import ArrivalRow from '../dashboard/ArrivalRow'
import DualDirectionCard from '../common/DualDirectionCard'

describe('Skeleton — 기본 shimmer 블록', () => {
  it('tj-skeleton 클래스와 aria-hidden을 갖는다', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild
    expect(el).toHaveClass('tj-skeleton')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SkeletonArrivalCard — ArrivalRow와 컨테이너 클래스 공유', () => {
  it('ArrivalRow(Card) 실제 카드와 동일한 rounded-card / p-4 박스를 갖는다', () => {
    const { container: real } = render(
      <ArrivalRow routeNumber="5602" direction="이마트" minutes={5} />
    )
    const { container: skel } = render(<SkeletonArrivalCard />)

    // 실제 카드: button > Card(div.rounded-card.p-4...)
    const realCard = real.querySelector('.rounded-card.p-4')
    const skelCard = skel.querySelector('.rounded-card.p-4')

    expect(realCard).not.toBeNull()
    expect(skelCard).not.toBeNull()
  })

  it('좌(뱃지) · 중앙(제목 2줄) · 우(숫자) 3분할 구조를 갖는다', () => {
    const { container } = render(<SkeletonArrivalCard />)
    const row = container.querySelector('.flex.items-center.gap-3')
    expect(row).not.toBeNull()
    // 좌: 뱃지 자리, 중앙: 2줄, 우: 숫자 자리 — 총 3개의 직계 자식
    expect(row.children.length).toBe(3)
    // 중앙 칸에 제목/부제 2줄이 있어야 실제 카드의 2줄 텍스트와 대응한다
    const centerCol = row.children[1]
    expect(centerCol.children.length).toBe(2)
  })

  it('aria-hidden으로 접근성 트리에서 제외된다', () => {
    const { container } = render(<SkeletonArrivalCard />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SkeletonPanelRow — DualDirectionCard와 컨테이너 클래스 공유', () => {
  it('DualDirectionCard 실제 카드와 동일한 rounded-card / p-4 박스를 갖는다', () => {
    const { container: real } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="var(--tj-accent)"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', minutes: 5 }}
        right={{ variant: 'normal', dir: '하행', minutes: 3 }}
      />
    )
    const { container: skel } = render(<SkeletonPanelRow />)

    const realCard = real.querySelector('.rounded-card.p-4')
    const skelCard = skel.querySelector('.rounded-card.p-4')

    expect(realCard).not.toBeNull()
    expect(skelCard).not.toBeNull()
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
