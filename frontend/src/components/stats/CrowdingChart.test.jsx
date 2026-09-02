/**
 * CrowdingChart — 범례 상시 노출 회귀 테스트.
 *
 * 결함: 막대 색이 무엇을 뜻하는지는 막대를 탭(hover/press)해 툴팁을 띄워야만
 * 알 수 있었다 — 모바일 터치에서는 사실상 못 봤다. 이제 여유/보통/혼잡/매우혼잡
 * 범례를 항상 렌더한다(RouteCrowdingSection의 범례와 같은 관례).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CrowdingChart from './CrowdingChart'

const POINTS = [
  { hour: 8, minute: 0, crowded: 2.1, ratio: 0.1, samples: 10, estimated: false, reliable: true },
  { hour: 8, minute: 30, crowded: 3.4, ratio: 0.4, samples: 12, estimated: false, reliable: true },
]

describe('CrowdingChart — 범례 상시 노출', () => {
  it('탭/호버 없이도 여유·보통·혼잡·매우혼잡 범례가 렌더된다', () => {
    render(<CrowdingChart points={POINTS} />)

    expect(screen.getByText('여유')).toBeInTheDocument()
    expect(screen.getByText('보통')).toBeInTheDocument()
    expect(screen.getByText('혼잡')).toBeInTheDocument()
    expect(screen.getByText('매우혼잡')).toBeInTheDocument()
  })

  it('범례에는 role=list/listitem으로 접근 가능한 구조가 있다', () => {
    render(<CrowdingChart points={POINTS} />)

    expect(screen.getByRole('list', { name: '혼잡도 범례' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
