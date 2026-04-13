import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ShuttleTab from './ShuttleTab'

vi.mock('../../hooks/useShuttle', () => ({
  useShuttleSchedule: () => ({
    data: {
      schedule_type: 'SEMESTER',
      schedule_name: '2026학년도 1학기',
      valid_from: '2026-03-02',
      valid_until: '2026-06-20',
      directions: [
        { direction: '정왕역', times: [{ depart_at: '07:30' }, { depart_at: '08:00' }, { depart_at: '12:00' }, { depart_at: '23:50' }] },
        { direction: '서울', times: [{ depart_at: '07:50' }, { depart_at: '12:30' }, { depart_at: '23:50' }] },
      ],
    },
    loading: false,
    error: null,
  }),
  useShuttleNext: () => ({
    data: { direction: '정왕역', depart_at: '12:00', arrive_in_seconds: 600, is_last: false },
    loading: false,
    error: null,
  }),
}))

describe('ShuttleTab', () => {
  it('스케줄명 렌더링', () => {
    render(<ShuttleTab />)
    expect(screen.getByText('2026학년도 1학기')).toBeInTheDocument()
  })

  it('기본 방면은 정왕역', () => {
    render(<ShuttleTab />)
    expect(screen.getByRole('button', { name: '정왕역' })).toBeInTheDocument()
  })

  it('방면 전환 시 시간표 변경', () => {
    render(<ShuttleTab />)
    expect(screen.getByText('07:30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '서울' }))
    expect(screen.getByText('07:50')).toBeInTheDocument()
  })

  it('카운트다운 MM:SS 형식 표시', () => {
    render(<ShuttleTab />)
    const countdownElement = screen.getByText('다음 셔틀까지').parentElement.querySelector('p:nth-child(2)')
    expect(countdownElement).toBeInTheDocument()
    expect(countdownElement?.textContent).toMatch(/\d{2}:\d{2}|\d+시간/)
  })
})
