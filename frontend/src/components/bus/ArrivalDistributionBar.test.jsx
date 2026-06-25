import { render, screen } from '@testing-library/react'
import ArrivalDistributionBar from './ArrivalDistributionBar'

describe('ArrivalDistributionBar', () => {
  it('renders nothing when p10/p50/p90 are all null', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={null} p50Min={null} p90Min={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('mini variant has no labels', () => {
    render(<ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="mini" />)
    expect(screen.queryByText(/p10/i)).toBeNull()
    expect(screen.queryByText(/p90/i)).toBeNull()
    expect(screen.queryByText(/중앙값/)).toBeNull()
  })

  it('full variant shows p10/중앙값/p90 labels', () => {
    render(<ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />)
    expect(screen.getByText(/p10 1분/)).toBeInTheDocument()
    expect(screen.getByText(/중앙값 4분/)).toBeInTheDocument()
    expect(screen.getByText(/p90 9분/)).toBeInTheDocument()
  })

  it('p10 == p90 still renders (no crash, dot visible)', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={5} p50Min={5} p90Min={5} variant="full" />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('bg-slate-* 클래스가 없어야 한다 (토큰 준수)', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />
    )
    const allClasses = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.className)
      .join(' ')
    expect(allClasses).not.toMatch(/\bbg-slate-\d/)
  })

  it('text-[10px] 클래스가 없어야 한다 (최소 12px 캡션 토큰 사용)', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />
    )
    const allClasses = Array.from(container.querySelectorAll('[class]'))
      .map((el) => el.className)
      .join(' ')
    expect(allClasses).not.toMatch(/text-\[(9|10|11)px\]/)
  })
})
