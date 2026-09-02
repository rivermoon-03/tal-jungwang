import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import NowAnchorLine from './NowAnchorLine'

describe('NowAnchorLine', () => {
  it('label이 있으면 알약 라벨과 좌우 라인을 렌더한다', () => {
    render(<NowAnchorLine label="지금 21:45 · 다음 3분" />)
    expect(screen.getByText('지금 21:45 · 다음 3분')).toBeTruthy()
    expect(screen.getByTestId('now-anchor-line')).toBeTruthy()
  })

  it('label이 없으면 아무것도 렌더하지 않는다(오늘 운행 종료)', () => {
    const { container } = render(<NowAnchorLine label={null} />)
    expect(container.firstChild).toBeNull()
  })
})
