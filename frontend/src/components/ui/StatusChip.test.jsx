import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusChip from './StatusChip'

describe('StatusChip', () => {
  it('이모지를 렌더하지 않는다', () => {
    const { container } = render(<StatusChip kind="last">막차</StatusChip>)
    expect(container.textContent).toBe('막차')
    expect(/\p{Extended_Pictographic}/u.test(container.textContent)).toBe(false)
  })
  it('children 텍스트 렌더', () => {
    const { getByText } = render(<StatusChip kind="realtime">실시간</StatusChip>)
    expect(getByText('실시간')).toBeTruthy()
  })
})
