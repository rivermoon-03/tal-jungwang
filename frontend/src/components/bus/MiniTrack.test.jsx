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
    expect(startDot.className).toMatch(/line-strong/)
    const startLabel = container.querySelector('[data-track-label="start"]')
    expect(startLabel.className).toMatch(/line-strong/)
  })

  // ── 시안 1: 경로 시각화 강화 ─────────────────────────────────────────────────

  it('시안1: 시작 노드가 14px (강화된 크기)', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    const startDot = container.querySelector('[data-track-pt="start"]')
    expect(startDot.className).toMatch(/w-\[14px\]/)
    expect(startDot.className).toMatch(/h-\[14px\]/)
  })

  it('시안1: 종점 노드가 14px (강화된 크기)', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    const endDot = container.querySelector('[data-track-pt="end"]')
    expect(endDot.className).toMatch(/w-\[14px\]/)
    expect(endDot.className).toMatch(/h-\[14px\]/)
  })

  it('시안1: 경유 노드가 hollow (border + surface 배경)', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    const midDot = container.querySelector('[data-track-pt="mid"]')
    expect(midDot.className).toMatch(/w-\[11px\]/)
    expect(midDot.className).toMatch(/h-\[11px\]/)
    // hollow: border 클래스 있어야 함
    expect(midDot.className).toMatch(/border/)
    // filled bg가 아닌 surface 배경
    expect(midDot.className).toMatch(/bg-surface/)
  })

  it('시안1: 트랙 라인이 3px 높이', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    const seg = container.querySelector('[data-track-seg]')
    expect(seg.className).toMatch(/h-\[3px\]/)
  })

  it('시안1: 역할 라벨(출발/경유/종점)이 표시된다', () => {
    render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    expect(screen.getByText('출발')).toBeInTheDocument()
    expect(screen.getByText('경유')).toBeInTheDocument()
    expect(screen.getByText('종점')).toBeInTheDocument()
  })

  it('시안1: 역할 라벨이 없는 경우 (no waypoints) 출발/종점만', () => {
    render(
      <MiniTrack origin="이마트" waypoints={[]} terminus="서울" category="express" />
    )
    expect(screen.getByText('출발')).toBeInTheDocument()
    expect(screen.getByText('종점')).toBeInTheDocument()
    expect(screen.queryByText('경유')).not.toBeInTheDocument()
  })

  it('시안1: 이름 라벨이 13px (기존 12px에서 업그레이드)', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    const startLabel = container.querySelector('[data-track-label="start"]')
    expect(startLabel.className).toMatch(/text-\[13px\]/)
  })

  it('시안1: 좌측 색상 테두리(border-l-)가 없다', () => {
    const { container } = render(
      <MiniTrack origin="시화터미널" waypoints={['사당']} terminus="강남" category="express" />
    )
    expect(container.innerHTML).not.toMatch(/\bborder-l-/)
  })
})
