/**
 * MarkerSheet — 시안2 카드 분리형 리디자인 테스트
 *
 * - 정류장명/도착/액션 렌더
 * - "빠듯" 상태(yellow) 미표시
 * - 시안2 구조 (노선 배지 리드블록 + 방향 + ETA)
 * - imminent/일반 두 단계 색상
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

describe('MarkerSheet — 기본 렌더', () => {
  it('정류장명이 헤더에 표시된다', () => {
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

  it('도착 방향 텍스트가 렌더된다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('인천 방면')).toBeTruthy()
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

describe('MarkerSheet — 액션 버튼', () => {
  it('"걸어가기" 버튼이 렌더된다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('걸어가기')).toBeTruthy()
  })

  it('"상세 보기" 버튼이 렌더된다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('상세 보기')).toBeTruthy()
  })
})

describe('MarkerSheet — 빠듯 상태 미표시 (시안2 요구사항)', () => {
  it('yellow(빠듯) boardingStatus가 있어도 "빠듯" 텍스트가 렌더되지 않는다', () => {
    const stationWithYellow = { ...baseStation, boardingStatus: 'yellow' }
    render(
      <MarkerSheet
        station={stationWithYellow}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.queryByText('빠듯')).toBeNull()
    expect(screen.queryByText('빠듯해요')).toBeNull()
  })

  it('ETA 7분 이하(7분)는 state-warn 색이 아닌 ink 색을 유지한다', () => {
    const arrivals7 = [
      { routeCode: '수인분당', routeColor: null, direction: '인천 방면', minutes: 7 },
    ]
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={arrivals7}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    const html = document.body.innerHTML
    // state-warn 클래스가 ETA에 적용되면 안 됨
    expect(html).not.toMatch(/text-state-warn/)
  })

  it('green(여유) boardingStatus는 "여유" 텍스트가 렌더된다', () => {
    const stationWithGreen = { ...baseStation, boardingStatus: 'green' }
    render(
      <MarkerSheet
        station={stationWithGreen}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('여유 있어요')).toBeTruthy()
  })

  it('red(서두르세요) boardingStatus는 "서두르세요" 텍스트가 렌더된다', () => {
    const stationWithRed = { ...baseStation, boardingStatus: 'red' }
    render(
      <MarkerSheet
        station={stationWithRed}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(screen.getByText('서두르세요')).toBeTruthy()
  })
})

describe('MarkerSheet — ETA 색상 두 단계 (imminent/일반)', () => {
  it('ETA 3분 이하는 imminent 클래스가 적용된다', () => {
    const imminentArrivals = [
      { routeCode: '수인분당', routeColor: null, direction: '인천 방면', minutes: 2 },
    ]
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={imminentArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    expect(document.body.innerHTML).toMatch(/imminent/)
  })

  it('ETA 10분은 imminent 클래스가 없어야 한다', () => {
    const normalArrivals = [
      { routeCode: '수인분당', routeColor: null, direction: '인천 방면', minutes: 10 },
    ]
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={normalArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    // ETA 텍스트 자체엔 imminent가 없어야 함
    // (다른 요소에 imminent가 있을 수 있으니 ETA span 기준으로 확인)
    const etaSpans = document.body.querySelectorAll('[data-eta]')
    etaSpans.forEach((span) => {
      expect(span.className).not.toMatch(/imminent/)
    })
  })
})

describe('MarkerSheet — 시안2 구조 (카드 분리형)', () => {
  it('12px 미만 폰트 클래스(text-[9px]/[10px]/[11px])가 없어야 한다', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    const html = document.body.innerHTML
    expect(html).not.toContain('text-[9px]')
    expect(html).not.toContain('text-[10px]')
    expect(html).not.toContain('text-[11px]')
  })

  it('노선 배지(리드블록)가 렌더된다 — data-route-badge 또는 노선코드 텍스트', () => {
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
      />
    )
    // 노선코드 앞부분이 배지로 렌더되어야 함
    expect(screen.getByText('수인분당')).toBeTruthy()
  })

  it('방향 토글이 있을 때 방향 라벨이 렌더된다', () => {
    const directionControl = {
      direction: 'outbound',
      outboundLabel: '소사·원시 방면',
      inboundLabel: '일산 방면',
      leftLabel: '소사',
      rightLabel: '일산',
      onChange: vi.fn(),
    }
    render(
      <MarkerSheet
        station={baseStation}
        arrivals={baseArrivals}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onDetail={vi.fn()}
        directionControl={directionControl}
      />
    )
    expect(screen.getByText('소사·원시 방면')).toBeTruthy()
    expect(screen.getByText('일산 방면')).toBeTruthy()
  })
})
