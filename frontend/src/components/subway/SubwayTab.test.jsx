import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SubwayTab from './SubwayTab'

vi.mock('../../hooks/useSubway', () => ({
  useSubwayTimetable: () => ({
    data: {
      station: '정왕',
      day_type: 'weekday',
      up: [
        { depart_at: '05:32', destination: '왕십리' },
        { depart_at: '06:02', destination: '청량리' },
        { depart_at: '15:02', destination: '왕십리' },
      ],
      down: [
        { depart_at: '05:47', destination: '오이도' },
        { depart_at: '06:17', destination: '인천' },
        { depart_at: '15:08', destination: '오이도' },
      ],
    },
    loading: false,
    error: null,
  }),
  useSubwayNext: () => ({
    data: {
      up: { depart_at: '15:02', arrive_in_seconds: 600, destination: '왕십리' },
      down: { depart_at: '15:08', arrive_in_seconds: 900, destination: '오이도' },
    },
    loading: false,
    error: null,
  }),
}))

describe('SubwayTab', () => {
  it('정왕역 / 수인분당선 헤더 렌더링', () => {
    render(<SubwayTab />)
    expect(screen.getByText(/정왕역 — 수인분당선/)).toBeInTheDocument()
  })

  it('상행/하행 탭 렌더링', () => {
    render(<SubwayTab />)
    expect(screen.getByRole('button', { name: /상행/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /하행/ })).toBeInTheDocument()
  })

  it('하행 탭 전환 시 오이도 행선지 표시', () => {
    render(<SubwayTab />)
    fireEvent.click(screen.getByRole('button', { name: /하행/ }))
    const oiDoElements = screen.getAllByText(/오이도/)
    expect(oiDoElements.length).toBeGreaterThan(0)
  })
})
