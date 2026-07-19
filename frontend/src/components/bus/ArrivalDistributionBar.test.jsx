import { render, screen } from '@testing-library/react'
import ArrivalDistributionBar from './ArrivalDistributionBar'
import { valueToPercent } from '../../utils/arrivalDistribution'

function findByClass(container, cls) {
  return Array.from(container.querySelectorAll('*')).find((el) =>
    el.className && el.className.toString().split(' ').includes(cls)
  )
}

describe('valueToPercent — 순수 함수', () => {
  it('정중앙 값은 50%에 가깝게 매핑된다', () => {
    expect(valueToPercent(10, 0, 20)).toBeCloseTo(50, 1)
  })

  it('양 끝 값은 도메인 패딩 때문에 0%/100%에 붙지 않는다', () => {
    expect(valueToPercent(0, 0, 20)).toBeGreaterThan(0)
    expect(valueToPercent(20, 0, 20)).toBeLessThan(100)
  })

  it('min과 max가 같으면 50을 반환한다(0 나눗셈 방지)', () => {
    expect(valueToPercent(5, 5, 5)).toBe(50)
  })

  it('value/min/max가 null이면 50을 반환한다', () => {
    expect(valueToPercent(null, 0, 20)).toBe(50)
    expect(valueToPercent(5, null, 20)).toBe(50)
    expect(valueToPercent(5, 0, null)).toBe(50)
  })

  it('결과는 항상 0~100 범위다', () => {
    expect(valueToPercent(-5, 0, 20)).toBeGreaterThanOrEqual(0)
    expect(valueToPercent(1000, 0, 20)).toBeLessThanOrEqual(100)
  })
})

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

  it('전체 트랙은 bg-surface-3 토큰, 높이 4px(h-1)을 사용한다', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />
    )
    const track = findByClass(container, 'bg-surface-3')
    expect(track).toBeTruthy()
    expect(track.className).toMatch(/\bh-1\b/)
    expect(track.className).toMatch(/rounded-full/)
  })

  it('밴드와 중앙값 도트 위치가 valueToPercent 계산과 일치한다 (maxMin 자동 확장 포함)', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />
    )
    const maxMin = Math.max(20, 9 + 1) // 컴포넌트와 동일한 규칙
    const expectedLeft = valueToPercent(1, 0, maxMin)
    const expectedRight = valueToPercent(9, 0, maxMin)
    const expectedWidth = Math.max(expectedRight - expectedLeft, 1.5)
    const expectedDot = valueToPercent(4, 0, maxMin)

    const band = findByClass(container, 'bg-accent/30')
    expect(band).toBeTruthy()
    expect(band.style.left).toBe(`${expectedLeft}%`)
    expect(band.style.width).toBe(`${expectedWidth}%`)

    const dot = findByClass(container, 'bg-accent')
    expect(dot).toBeTruthy()
    expect(dot.style.left).toBe(`${expectedDot}%`)
  })

  it('양끝 캡 2개(p10 경계, p90 경계)가 렌더된다', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />
    )
    const caps = container.querySelectorAll('[aria-hidden="true"]')
    expect(caps.length).toBe(2)
  })

  it('maxMin이 p90보다 작아도 p90+1로 자동 확장된다', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={5} p50Min={15} p90Min={30} variant="full" maxMin={10} />
    )
    const maxMin = Math.max(10, 30 + 1) // 31
    const expectedDot = valueToPercent(15, 0, maxMin)
    const dot = findByClass(container, 'bg-accent')
    expect(dot.style.left).toBe(`${expectedDot}%`)
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

  it('임의 hex 색상이 인라인 스타일/클래스에 없어야 한다', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />
    )
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
