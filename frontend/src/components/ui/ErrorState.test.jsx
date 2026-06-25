import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ErrorState from './ErrorState'

describe('ErrorState', () => {
  it('onRetry 있으면 재시도 버튼 노출·클릭', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="지금은 불러올 수 없어요" onRetry={onRetry} />)
    screen.getByRole('button', { name: /다시 시도/ }).click()
    expect(onRetry).toHaveBeenCalled()
  })
  it('onRetry 없으면 버튼 없음', () => {
    render(<ErrorState message="에러" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
