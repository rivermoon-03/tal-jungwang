import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InfoPanelPC from './InfoPanelPC'

vi.mock('./InfoPanelTabs', () => ({
  default: ({ tab }) => <div data-testid="tabs">tab:{tab}</div>,
}))

describe('InfoPanelPC', () => {
  it('절대 위치 카드가 렌더링된다', () => {
    const { container } = render(
      <InfoPanelPC tab="jeongwang" setTab={() => {}} subwayData={null} busJeongwangData={null} busSeoulData={null} walkSec={720} />
    )
    const card = container.firstChild
    expect(card.className).toMatch(/absolute/)
  })

  it('InfoPanelTabs에 tab prop을 전달한다', () => {
    render(
      <InfoPanelPC tab="seoul" setTab={() => {}} subwayData={null} busJeongwangData={null} busSeoulData={null} walkSec={720} />
    )
    expect(screen.getByText('tab:seoul')).toBeInTheDocument()
  })
})
