/**
 * ScheduleSection — 토큰 정리 검증 테스트
 * TDD: 구현 전 FAIL → 토큰화 후 PASS
 *
 * 핵심 단언:
 *  1. text-[9px] / text-[10px] / text-[11px] 극소 글자 미사용
 *  2. bg-chip-blue-bg / bg-chip-red-bg 인라인 색칩 클래스 미사용
 *  3. 베타/막차 배지가 StatusChip 구조 (rounded-full span)
 *  4. text-slate- / text-gray- 하드코딩 색 미사용
 *  5. 핵심 텍스트 렌더
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScheduleSection from './ScheduleSection'

vi.mock('../common/Skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
}))

vi.mock('../common/RouteBadge', () => ({
  default: ({ route }) => <span data-testid="route-badge">{route}</span>,
}))

vi.mock('../bus/BusArrivalCard', () => ({
  CrowdedBadge: ({ level }) => <span data-testid="crowded-badge">{level}</span>,
}))

vi.mock('../../utils/trainTime', () => ({
  formatRelAbs: (minutes, hhmm) => `${minutes}분 뒤 · ${hhmm}`,
}))

const BASE_PROPS = {
  title: '301번',
  subtitle: '정왕역 방면',
  type: 'bus',
  routeCode: '301',
  next: '5분 뒤',
  afterNext: '15분 뒤',
}

describe('ScheduleSection — 극소 글자 미사용', () => {
  it('text-[9px]/[10px]/[11px] 클래스가 없어야 한다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })
})

describe('ScheduleSection — 인라인 색칩(bg-chip-*) 클래스 미사용', () => {
  it('bg-chip-blue-bg 클래스가 없어야 한다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} testBadge={true} realtimeOnly={true} />
    )
    expect(container.innerHTML).not.toMatch(/bg-chip-blue-bg/)
  })

  it('bg-chip-red-bg 클래스가 없어야 한다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} lastBus={true} />
    )
    expect(container.innerHTML).not.toMatch(/bg-chip-red-bg/)
  })

  it('text-chip-blue-fg 클래스가 없어야 한다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} testBadge={true} />
    )
    expect(container.innerHTML).not.toMatch(/text-chip-blue-fg/)
  })

  it('text-chip-red-fg 클래스가 없어야 한다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} lastBus={true} />
    )
    expect(container.innerHTML).not.toMatch(/text-chip-red-fg/)
  })
})

describe('ScheduleSection — slate/gray 하드코딩 색 미사용', () => {
  it('text-slate- 클래스가 없어야 한다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} onClick={vi.fn()} />)
    expect(container.innerHTML).not.toMatch(/text-slate-/)
  })
})

describe('ScheduleSection — 베타/막차 배지 StatusChip 구조', () => {
  it('testBadge=true 이면 "베타" 텍스트가 rounded-full span 으로 렌더된다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} testBadge={true} />
    )
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '베타' && el.className.includes('rounded-full'),
    )
    expect(chips.length).toBeGreaterThan(0)
  })

  it('lastBus=true 이면 "막차" 텍스트가 rounded-full span 으로 렌더된다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} lastBus={true} />
    )
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '막차' && el.className.includes('rounded-full'),
    )
    expect(chips.length).toBeGreaterThan(0)
  })

  it('realtimeOnly=true 이면 "실시간" 텍스트가 rounded-full span 으로 렌더된다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} realtimeOnly={true} />
    )
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '실시간' && el.className.includes('rounded-full'),
    )
    expect(chips.length).toBeGreaterThan(0)
  })
})

describe('ScheduleSection — 핵심 텍스트 렌더', () => {
  it('title 이 렌더된다', () => {
    render(<ScheduleSection {...BASE_PROPS} />)
    expect(screen.getByText('301번')).toBeTruthy()
  })

  it('다음 도착 시간 next 가 렌더된다', () => {
    render(<ScheduleSection {...BASE_PROPS} />)
    const matches = screen.getAllByText(/5분 뒤/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('loading=true 이면 Skeleton 이 렌더된다', () => {
    render(<ScheduleSection {...BASE_PROPS} loading={true} />)
    expect(screen.getByTestId('skeleton')).toBeTruthy()
  })

  it('endOfDay=true 이면 "금일 종료" 문구가 렌더된다', () => {
    render(<ScheduleSection {...BASE_PROPS} endOfDay={true} />)
    const endOfDayText = screen.queryAllByText(/오늘 버스가 끊겼어요/)
    const kinilText = screen.queryAllByText(/금일/)
    expect(endOfDayText.length + kinilText.length).toBeGreaterThan(0)
  })

  it('disabled=true 이면 disabledLabel 이 렌더된다', () => {
    render(<ScheduleSection {...BASE_PROPS} disabled={true} disabledLabel="지원 예정" />)
    expect(screen.getByText('지원 예정')).toBeTruthy()
  })
})
