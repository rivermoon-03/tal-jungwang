/**
 * SubwayRealtimeBoard — 토큰 정리 검증 테스트
 * TDD: 구현 전 FAIL → 토큰화 후 PASS
 *
 * 핵심 단언:
 *  1. text-[10px] 등 극소 글자 미사용
 *  2. text-red-400 / bg-amber-* 생색 직접 클래스 미사용
 *  3. 막차/베타 배지가 StatusChip 구조 (rounded-full span)
 *  4. 핵심 텍스트 렌더
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubwayRealtimeBoard from './SubwayRealtimeBoard'

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({ darkMode: false }),
}))

vi.mock('../../hooks/useSecondsCountdown', () => ({
  useSecondsCountdown: (secs) => ({
    display: secs != null ? `${Math.ceil(secs / 60)}분` : null,
    totalSeconds: secs,
    isUrgent: secs != null && secs < 120,
  }),
}))

vi.mock('../../utils/trainTime', () => ({
  nextTimetableSeconds: () => null,
}))

const BASE_ARRIVAL = {
  train_no: 'T001',
  line: '4호선',
  direction: '상행',
  destination: '당고개',
  color: '#1B5FAD',
  status_code: 2,
  status_msg: '출발',
  location_msg: null,
  smart_status: null,
  arrive_seconds: 300,
  is_last_train: false,
  train_type: '일반',
  recptn_dt: null,
  ordkey: null,
}

const LAST_TRAIN_ARRIVAL = {
  ...BASE_ARRIVAL,
  train_no: 'T002',
  is_last_train: true,
}

const IMMINENT_ARRIVAL = {
  ...BASE_ARRIVAL,
  train_no: 'T003',
  status_code: 1,
  arrive_seconds: 0,
}

describe('SubwayRealtimeBoard — 극소 글자 미사용', () => {
  it('text-[9px]/[10px]/[11px] 클래스가 없어야 한다', () => {
    const { container } = render(
      <SubwayRealtimeBoard
        arrivals={[BASE_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
      />
    )
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })
})

describe('SubwayRealtimeBoard — 생색 직접 클래스 미사용', () => {
  it('text-red-400 클래스가 없어야 한다', () => {
    const { container } = render(
      <SubwayRealtimeBoard
        arrivals={[IMMINENT_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
      />
    )
    expect(container.innerHTML).not.toMatch(/text-red-400/)
  })

  it('bg-amber- 클래스가 없어야 한다 (amber 배경 생색 제거)', () => {
    const { container } = render(
      <SubwayRealtimeBoard
        arrivals={[BASE_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
        stale={true}
      />
    )
    expect(container.innerHTML).not.toMatch(/bg-amber-/)
  })

  it('bg-red-500 / text-red-500 생색이 없어야 한다', () => {
    const { container } = render(
      <SubwayRealtimeBoard
        arrivals={[LAST_TRAIN_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
      />
    )
    expect(container.innerHTML).not.toMatch(/bg-red-500/)
    expect(container.innerHTML).not.toMatch(/text-red-500/)
  })
})

describe('SubwayRealtimeBoard — 막차 배지 StatusChip 구조', () => {
  it('막차 배지가 rounded-full span 구조다', () => {
    const { container } = render(
      <SubwayRealtimeBoard
        arrivals={[LAST_TRAIN_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
      />
    )
    const chips = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent.trim() === '막차' && el.className.includes('rounded-full'),
    )
    expect(chips.length).toBeGreaterThan(0)
  })
})

describe('SubwayRealtimeBoard — 핵심 텍스트 렌더', () => {
  it('목적지가 렌더된다', () => {
    render(
      <SubwayRealtimeBoard
        arrivals={[BASE_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
      />
    )
    expect(screen.getByText('당고개')).toBeTruthy()
  })

  it('arrivals 가 빈 배열이면 안내 문구가 렌더된다', () => {
    render(
      <SubwayRealtimeBoard
        arrivals={[]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
      />
    )
    expect(screen.getByText('현재 운행 중인 열차 정보가 없습니다')).toBeTruthy()
  })

  it('stale=true 이면 stale 경고 배너가 렌더된다', () => {
    render(
      <SubwayRealtimeBoard
        arrivals={[BASE_ARRIVAL]}
        lastFetchedAt={null}
        onRowClick={vi.fn()}
        stale={true}
      />
    )
    expect(screen.getByText(/잠시 끊겼습니다|지연/)).toBeTruthy()
  })
})
