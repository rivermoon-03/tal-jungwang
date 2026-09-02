import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TimeChip from './TimeChip'

describe('TimeChip', () => {
  it('시각을 렌더한다', () => {
    render(<TimeChip time="21:48" />)
    expect(screen.getByText('21:48')).toBeTruthy()
  })

  it('최소 폭 52px · 최소 높이 44px(터치 타깃) · rounded-tile · tabular-nums를 지킨다', () => {
    render(<TimeChip time="21:48" />)
    const chip = screen.getByText('21:48').closest('.rounded-tile')
    expect(chip.className).toMatch(/min-w-\[52px\]/)
    expect(chip.className).toMatch(/min-h-\[44px\]/)
    expect(chip.className).toMatch(/rounded-tile/)
    expect(chip.className).toMatch(/tabular-nums/)
  })

  it('지난 시각은 흐리게(opacity-40)만 하고 배경은 유지한다', () => {
    render(<TimeChip time="20:05" isPast />)
    const chip = screen.getByText('20:05').closest('.rounded-tile')
    expect(chip.className).toMatch(/opacity-40/)
    expect(chip.className).toMatch(/bg-surface-2/)
  })

  it('다음 한 대는 accent 배경 + 흰 글자로 채운다', () => {
    render(<TimeChip time="21:48" isNext />)
    const chip = screen.getByText('21:48').closest('.rounded-tile')
    expect(chip.className).toMatch(/bg-accent\b/)
    expect(chip.className).toMatch(/text-white/)
    expect(chip.className).not.toMatch(/opacity-40/)
  })

  // 임의값 text-[12px] 는 --tj-font-scale 밖이라 글자 크기 설정이 안 먹었다.
  // 같은 12px 인 chip 토큰으로 옮겼다(tailwind.config.js 의 chip = 12px).
  // 12px 미만 금지 정책은 tokenRules.test.js 가 전역으로 강제한다.
  it('부제(sub)는 12px 토큰(text-chip)으로 렌더된다 — 임의값이 아니다', () => {
    render(<TimeChip time="18:00" sub="학교 18:00 출발" />)
    const sub = screen.getByText('학교 18:00 출발')
    expect(sub.className).toMatch(/\btext-chip\b/)
    expect(sub.className).not.toMatch(/text-\[\d/)
  })

  it('sub가 없으면 부제를 렌더하지 않는다', () => {
    render(<TimeChip time="18:00" />)
    expect(screen.queryByText(/출발/)).toBeNull()
  })

  it('lastBadge가 켜지면 "막차" 배지를 렌더한다', () => {
    render(<TimeChip time="22:10" lastBadge />)
    expect(screen.getByText('막차')).toBeTruthy()
  })

  it('lastBadge가 꺼져 있으면 "막차" 배지를 렌더하지 않는다', () => {
    render(<TimeChip time="22:10" />)
    expect(screen.queryByText('막차')).toBeNull()
  })

  it('chipRef를 칩 최상위 요소에 연결한다(자동 스크롤 대상)', () => {
    let ref = null
    render(<TimeChip time="21:48" isNext chipRef={(el) => { ref = el }} />)
    expect(ref).not.toBeNull()
    expect(ref.className).toMatch(/rounded-tile/)
  })
})
