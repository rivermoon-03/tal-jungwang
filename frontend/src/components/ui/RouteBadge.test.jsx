import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RouteBadge from './RouteBadge'

describe('RouteBadge', () => {
  it('노선 번호를 렌더한다', () => {
    const { getByText } = render(<RouteBadge route="33" />)
    expect(getByText('33')).toBeTruthy()
  })
})
