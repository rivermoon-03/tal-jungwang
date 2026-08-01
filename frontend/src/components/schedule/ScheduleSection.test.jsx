/**
 * ScheduleSection — 행 규격 리디자인(시간열 56px + 본문 + ★) 검증 테스트
 *
 * 핵심 단언:
 *  1. text-[9px] / text-[10px] / text-[11px] 극소 글자 클래스 미사용, em-dash("—") 미사용
 *  2. 행선지 title이 말줄임(overflow/ellipsis) 없이 그대로 렌더된다
 *  3. 시간열: "N분" + hhmm, 임박(imminent)이면 "곧"
 *  4. 미운행(disabled)/금일종료(endOfDay) 상태 문구
 *  5. 즐겨찾기 토글 버튼 동작
 *  6. 베타/막차/실시간 배지가 StatusChip 구조(rounded-full span)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

const BASE_PROPS = {
  title: '강남행',
  routeCode: '3400',
  type: 'bus',
  minutesUntil: 5,
  hhmm: '14:52',
}

describe('ScheduleSection — 극소 글자·em-dash 미사용', () => {
  it('text-[9px]/[10px]/[11px] 클래스가 없어야 한다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })

  it('em-dash("—")를 렌더하지 않는다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} />)
    expect(container.textContent).not.toContain('—')
  })

  it('데이터 없음 상태에서도 em-dash 대신 텍스트로 표시한다', () => {
    render(<ScheduleSection {...BASE_PROPS} minutesUntil={null} hhmm={null} />)
    expect(screen.getByText('정보 없음')).toBeInTheDocument()
  })
})

describe('ScheduleSection — 행선지 제목은 말줄임되지 않는다', () => {
  it('긴 행선지 문자열이 그대로 텍스트로 존재한다(overflow/ellipsis 스타일 없음)', () => {
    render(<ScheduleSection {...BASE_PROPS} title="아이파크아파트행" />)
    const titleEl = screen.getByText('아이파크아파트행')
    expect(titleEl.style.textOverflow).not.toBe('ellipsis')
    expect(titleEl.style.whiteSpace).not.toBe('nowrap')
  })
})

describe('ScheduleSection — 시간열 규격', () => {
  it('"N분"과 hhmm이 렌더된다', () => {
    render(<ScheduleSection {...BASE_PROPS} />)
    expect(screen.getByText('5분')).toBeInTheDocument()
    expect(screen.getByText('14:52')).toBeInTheDocument()
  })

  it('imminent=true 이면 "곧"이 렌더되고 --tj-imminent 색을 쓴다', () => {
    render(<ScheduleSection {...BASE_PROPS} imminent minutesUntil={0} />)
    const soon = screen.getByText('곧')
    expect(soon.style.color).toBe('var(--tj-imminent)')
  })

  it('60분 이상이면 시간 단위로 표시한다', () => {
    render(<ScheduleSection {...BASE_PROPS} minutesUntil={90} hhmm="16:20" />)
    expect(screen.getByText('1시간 30분')).toBeInTheDocument()
  })
})

describe('ScheduleSection — 미운행/금일종료 상태', () => {
  it('disabled=true + timeLines 두 줄 + disabledLabel이 렌더된다', () => {
    render(
      <ScheduleSection
        {...BASE_PROPS}
        disabled
        timeLines={['주말', '미운행']}
        disabledLabel="월요일 첫차 06:30 · 시화터미널 출발"
      />
    )
    expect(screen.getByText('월요일 첫차 06:30 · 시화터미널 출발')).toBeInTheDocument()
  })

  it('timeLines=["금일","종료"] 이면 시간열에 해당 문구가 렌더된다', () => {
    const { container } = render(
      <ScheduleSection {...BASE_PROPS} timeLines={['금일', '종료']} minutesUntil={null} />
    )
    expect(container.textContent).toContain('금일')
    expect(container.textContent).toContain('종료')
  })
})

describe('ScheduleSection — 배지 StatusChip 구조', () => {
  it('liveChip=true 이면 "실시간" 텍스트가 rounded-full span 으로 렌더된다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} liveChip />)
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '실시간' && el.className.includes('rounded-full'),
    )
    expect(chips.length).toBeGreaterThan(0)
  })

  it('lastBus=true 이면 "막차" 텍스트가 rounded-full span 으로 렌더된다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} lastBus />)
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '막차' && el.className.includes('rounded-full'),
    )
    expect(chips.length).toBeGreaterThan(0)
  })
})

describe('ScheduleSection — 즐겨찾기 토글', () => {
  it('onToggleFavorite이 있으면 별 버튼이 렌더되고 클릭 시 호출된다(행 onClick과 분리)', () => {
    const onToggleFavorite = vi.fn()
    const onClick = vi.fn()
    render(
      <ScheduleSection
        {...BASE_PROPS}
        isFavorite={false}
        onToggleFavorite={onToggleFavorite}
        onClick={onClick}
      />
    )
    fireEvent.click(screen.getByLabelText('즐겨찾기 추가'))
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ScheduleSection — 선택(desktop master-detail) 하이라이트', () => {
  it('selected=true 이면 accent 보더를 적용한다', () => {
    const { container } = render(<ScheduleSection {...BASE_PROPS} selected onClick={vi.fn()} />)
    const row = container.firstChild
    expect(row.style.border).toContain('var(--tj-accent)')
  })
})

describe('ScheduleSection — 아랫줄 경유 텍스트(출발 정류장 bold)', () => {
  it('boldPrefix + subtitle이 함께 렌더된다', () => {
    render(
      <ScheduleSection
        {...BASE_PROPS}
        boldPrefix="시화터미널"
        subtitle=" → 사당 → 강남 · 다음 15:22"
      />
    )
    expect(screen.getByText('시화터미널')).toBeInTheDocument()
    expect(screen.getByText(/사당 → 강남 · 다음 15:22/)).toBeInTheDocument()
  })
})
