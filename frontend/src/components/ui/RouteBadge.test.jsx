import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RouteBadge from './RouteBadge'

describe('RouteBadge', () => {
  it('노선 번호를 렌더한다', () => {
    const { getByText } = render(<RouteBadge route="33" />)
    expect(getByText('33')).toBeTruthy()
  })

  it('variant="tile"이면 56px(w-14/h-14) 정사각 타일을 렌더한다', () => {
    const { getByText } = render(<RouteBadge route="33" variant="tile" />)
    const el = getByText('33')
    expect(el.className).toMatch(/w-14/)
    expect(el.className).toMatch(/h-14/)
  })

  it('variant="tile" + mode가 있으면 글리프를 함께 렌더한다', () => {
    const { container } = render(<RouteBadge route="33" variant="tile" mode="bus" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('variant="tile"이고 mode가 없으면 글리프 없이 번호만 렌더한다', () => {
    const { container } = render(<RouteBadge route="33" variant="tile" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
