import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FloatingDock from './FloatingDock'

describe('FloatingDock', () => {
  it('탭 3개(홈/학식/더보기) aria-label, 시각 텍스트 라벨 없음', () => {
    render(<FloatingDock />)
    expect(screen.getByLabelText('홈')).toBeInTheDocument()
    expect(screen.getByLabelText('학식')).toBeInTheDocument()
    expect(screen.getByLabelText('더보기')).toBeInTheDocument()
    expect(screen.queryByText('시간표')).toBeNull()
    expect(screen.queryByText('지도')).toBeNull()
  })
})
