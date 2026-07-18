import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MiniTrack from './MiniTrack'

describe('MiniTrack (칩 라인형 · 시안3)', () => {
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

  it('renders two labels for a t2 path (no waypoints, no mid chip)', () => {
    const { container } = render(
      <MiniTrack origin="이마트" waypoints={[]} terminus="서울" category="express" />
    )
    expect(screen.getByText('이마트')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-track-pt="mid"]').length).toBe(0)
  })

  it('renders four labels for a t4 path (2 waypoints) — 경유지가 많아도 칩이 늘어날 뿐 안 깨짐', () => {
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

  it('applies category color class to origin chip', () => {
    const { container } = render(
      <MiniTrack origin="한국공대" waypoints={['정왕역']} terminus="시흥시청" category="local" />
    )
    const startChip = container.querySelector('[data-track-pt="start"]')
    expect(startChip.className).toMatch(/line-33/)
  })

  it('renders muted state with gray styles on origin/terminus chips', () => {
    const { container } = render(
      <MiniTrack
        origin="한국공대"
        waypoints={[]}
        terminus="정왕역"
        category="local"
        muted
      />
    )
    const startChip = container.querySelector('[data-track-pt="start"]')
    expect(startChip.className).toMatch(/line-strong/)
    const endChip = container.querySelector('[data-track-pt="end"]')
    expect(endChip.className).toMatch(/line-strong/)
  })

  it('역할(출발/경유/종점)은 화면에 별도 텍스트로 안 보이고 접근성 라벨(aria-label)로만 남는다', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    expect(screen.queryByText('출발')).not.toBeInTheDocument()
    expect(screen.queryByText('경유')).not.toBeInTheDocument()
    expect(screen.queryByText('종점')).not.toBeInTheDocument()
    expect(container.querySelector('[data-track-pt="start"]').getAttribute('aria-label')).toBe('출발: 시화터미널')
    expect(container.querySelector('[data-track-pt="mid"]').getAttribute('aria-label')).toBe('경유: 사당')
    expect(container.querySelector('[data-track-pt="end"]').getAttribute('aria-label')).toBe('종점: 강남')
  })

  it('칩 컨테이너가 flex-wrap이라 폭이 좁아도 겹치지 않고 다음 줄로 넘어간다', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['시흥시청', '광명']} terminus="사당" category="express" />
    )
    const wrap = container.firstChild
    expect(wrap.className).toMatch(/flex-wrap/)
  })

  it('각 칩은 truncate + max-width로 역명이 길어도 칩 하나가 무한정 늘어나지 않는다', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['시흥시청']} terminus="사당" category="express" />
    )
    const startChip = container.querySelector('[data-track-pt="start"]')
    expect(startChip.className).toMatch(/truncate/)
    expect(startChip.className).toMatch(/max-w-\[120px\]/)
  })
})
