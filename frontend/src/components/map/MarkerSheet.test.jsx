/**
 * MarkerSheet — 글자 크기·색 토큰·ETA 검사
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MarkerSheet from './MarkerSheet'

// useAppStore mock
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      favorites: { stations: [] },
      toggleFavoriteStation: vi.fn(),
    }),
}))

// RouteSpine mock
vi.mock('./RouteSpine', () => ({
  default: () => null,
}))

const baseStation = {
  id: '1',
  name: '정왕역',
  type: 'subway',
  walkMinutes: 3,
  walkMeters: 200,
  boardingStatus: null,
}

const baseArrivals = [
  { routeCode: '수인분당', routeColor: null, direction: '인천 방면', minutes: 5 },
  { routeCode: '수인분당', routeColor: null, direction: '인천 방면', minutes: 12 },
]

describe('MarkerSheet — 글자 크기 & 토큰', () => {
  it('text-[9px] / text-[10px] / text-[11px] 클래스가 없어야 한다', () => {
    const { container } = render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    const html = container.innerHTML
    expect(html).not.toContain('text-[9px]')
    expect(html).not.toContain('text-[10px]')
    expect(html).not.toContain('text-[11px]')
  })

  it('도착 정류장 이름이 렌더된다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('정왕역')).toBeTruthy()
  })

  it('ETA 3분 이하는 imminent 클래스가 적용된다', () => {
    const imminentArrivals = [
      { routeCode: '수인분당', routeColor: null, direction: '인천 방면', minutes: 2 },
    ]
    const { container } = render(
      <MarkerSheet
        station={baseStation}
        arrivals={imminentArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    const html = container.innerHTML
    // imminent 색상 클래스 포함
    expect(html).toMatch(/imminent/)
  })

  it('도착 정보가 없으면 안내 문구가 렌더된다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={[]}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('도착 정보가 없습니다')).toBeTruthy()
  })

  it('도보 정보가 헤더에 표시된다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={[]}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText(/도보/)).toBeTruthy()
    expect(screen.getByText(/3분/)).toBeTruthy()
  })
})
