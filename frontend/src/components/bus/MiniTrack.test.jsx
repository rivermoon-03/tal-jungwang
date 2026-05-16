import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MiniTrack from './MiniTrack'

describe('MiniTrack', () => {
  it('renders all three labels for a t3 path (origin → 1 waypoint → terminus)', () => {
    render(
      <MiniTrack
        origin="시화터미널"
        waypoints={['신천역']}
        terminus="신도림"
        category="express"
      />
    )
    expect(screen.getByText('시화터미널')).toBeInTheDocument()
    expect(screen.getByText('신천역')).toBeInTheDocument()
    expect(screen.getByText('신도림')).toBeInTheDocument()
  })

  it('renders two labels for a t2 path (no waypoints)', () => {
    const { container } = render(
      <MiniTrack origin="이마트" waypoints={[]} terminus="서울" category="express" />
    )
    expect(screen.getByText('이마트')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    // 트랙 시작·끝 도트만 (경유 도트 없음)
    expect(container.querySelectorAll('[data-track-pt]').length).toBe(2)
  })

  it('renders four labels for a t4 path (2 waypoints)', () => {
    render(
      <MiniTrack
        origin="시화터미널"
        waypoints={['신천역', '영등포']}
        terminus="신도림"
        category="express"
      />
    )
    expect(screen.getByText('시화터미널')).toBeInTheDocument()
    expect(screen.getByText('신천역')).toBeInTheDocument()
    expect(screen.getByText('영등포')).toBeInTheDocument()
    expect(screen.getByText('신도림')).toBeInTheDocument()
  })

  it('applies category color class to origin label and start dot', () => {
    const { container } = render(
      <MiniTrack origin="한국공대" waypoints={['정왕역']} terminus="시흥시청" category="local" />
    )
    const startDot = container.querySelector('[data-track-pt="start"]')
    expect(startDot.className).toMatch(/line-33/)
    const startLabel = container.querySelector('[data-track-label="start"]')
    expect(startLabel.className).toMatch(/text-line-33/)
  })

  it('renders muted state with gray styles', () => {
    const { container } = render(
      <MiniTrack
        origin="한국공대"
        waypoints={[]}
        terminus="정왕역"
        category="local"
        muted
      />
    )
    const startDot = container.querySelector('[data-track-pt="start"]')
    expect(startDot.className).toMatch(/mute-2/)
    const startLabel = container.querySelector('[data-track-label="start"]')
    expect(startLabel.className).toMatch(/mute-2/)
  })
})
