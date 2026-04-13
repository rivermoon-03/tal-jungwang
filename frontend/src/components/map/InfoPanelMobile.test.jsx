import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InfoPanelMobile from './InfoPanelMobile'

vi.mock('./InfoPanelTabs', () => ({
  default: () => <div data-testid="tabs-content" />,
}))

const subwayData = {
  up: { arrive_in_seconds: 180 },
  down: { arrive_in_seconds: 420 },
  line4_up: { arrive_in_seconds: 300 },
  line4_down: { arrive_in_seconds: 660 },
}

describe('InfoPanelMobile', () => {
  it('미니뱃지가 렌더링된다', () => {
    render(
      <InfoPanelMobile tab="jeongwang" setTab={() => {}} subwayData={subwayData} busJeongwangData={null} busSeoulData={null} walkSec={720} />
    )
    expect(screen.getByRole('button', { name: /정왕역/ })).toBeInTheDocument()
  })

  it('뱃지 클릭 시 하단 시트가 열린다', () => {
    render(
      <InfoPanelMobile tab="jeongwang" setTab={() => {}} subwayData={subwayData} busJeongwangData={null} busSeoulData={null} walkSec={720} />
    )
    expect(screen.queryByTestId('tabs-content')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /정왕역/ }))
    expect(screen.getByTestId('tabs-content')).toBeInTheDocument()
  })

  it('시트 열린 상태에서 배경 클릭 시 닫힌다', () => {
    render(
      <InfoPanelMobile tab="jeongwang" setTab={() => {}} subwayData={subwayData} busJeongwangData={null} busSeoulData={null} walkSec={720} />
    )
    fireEvent.click(screen.getByRole('button', { name: /정왕역/ }))
    expect(screen.getByTestId('tabs-content')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(screen.queryByTestId('tabs-content')).toBeNull()
  })
})
