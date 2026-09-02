/**
 * FlowChart — 범례 상시 노출 회귀 테스트.
 *
 * 결함: 곡선이 지금 원활/서행/정체 중 어디쯤인지는 탭(hover/press)해 툴팁을
 * 띄워야만 알 수 있었다 — 모바일 터치에서는 사실상 못 봤다. TrafficFlowCard와
 * 같은 색 규칙(ease·imminent·delayed)으로 항상 보이는 범례를 렌더한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FlowChart from './FlowChart'

const POINTS = [
  { hour: 8, minute: 0, speed: 30 },
  { hour: 8, minute: 30, speed: 12 },
  { hour: 9, minute: 0, speed: 20 },
]

describe('FlowChart — 범례 상시 노출', () => {
  it('탭/호버 없이도 원활·서행·정체 범례가 렌더된다', () => {
    render(<FlowChart points={POINTS} />)

    expect(screen.getByText('원활')).toBeInTheDocument()
    expect(screen.getByText('서행')).toBeInTheDocument()
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  it('범례에는 role=list/listitem으로 접근 가능한 구조가 있다', () => {
    render(<FlowChart points={POINTS} />)

    expect(screen.getByRole('list', { name: '교통 흐름 범례' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
