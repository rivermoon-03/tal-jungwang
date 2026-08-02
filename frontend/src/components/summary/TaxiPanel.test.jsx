import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 스토어 모킹 (기본: userLocation 있음) ──
vi.mock('../../stores/useAppStore', () => ({
  default: vi.fn((selector) =>
    selector({
      userLocation: { lat: 37.351, lng: 126.742 },
      driveRouteCoords: null,
      setDriveRouteCoords: vi.fn(),
      setUserLocation: vi.fn(),
    }),
  ),
}))

// ── API 모킹 ──
vi.mock('../../hooks/useApi', () => ({
  apiFetch: vi.fn(() =>
    Promise.resolve({
      duration_seconds: 600,
      distance_meters: 3200,
      taxi_fee: 4800,
      coordinates: [],
    }),
  ),
}))

import TaxiPanel from './TaxiPanel'

describe('TaxiPanel — AI티 제거 검증', () => {
  it('slate/gray 생색 클래스를 사용하지 않는다', () => {
    const { container } = render(<TaxiPanel />)
    expect(container.innerHTML).not.toMatch(/\btext-slate-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\btext-gray-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\bbg-slate-\d+\b/)
    expect(container.innerHTML).not.toMatch(/\bbg-gray-\d+\b/)
  })

  it('9~11px 인라인 폰트 크기를 사용하지 않는다', () => {
    const { container } = render(<TaxiPanel />)
    expect(container.innerHTML).not.toMatch(/font-size:\s*(9|10|11)px/)
  })

  it('좌측 바(border-l) 클래스를 사용하지 않는다', () => {
    const { container } = render(<TaxiPanel />)
    expect(container.innerHTML).not.toMatch(/border-l[-[]/);
  })

  it('목적지 이름 4개를 모두 렌더한다', () => {
    render(<TaxiPanel />)
    expect(screen.getByText('정왕역')).toBeInTheDocument()
    expect(screen.getByText('시흥시청역')).toBeInTheDocument()
    expect(screen.getByText('사당역')).toBeInTheDocument()
    expect(screen.getByText(/배곧/)).toBeInTheDocument()
  })

  it('분할 요금 (2명, 4명)을 렌더한다', async () => {
    render(<TaxiPanel />)
    await waitFor(() => {
      const twoPersonFares = screen.getAllByText('2명이 나누면 2,400원')
      const fourPersonFares = screen.getAllByText('4명이 나누면 1,200원')
      expect(twoPersonFares.length).toBeGreaterThan(0)
      expect(fourPersonFares.length).toBeGreaterThan(0)
    })
  })

  it('내 위치 출발이 기본이고, 학교 정문 출발로 바꾸면 승차 포인트가 따라온다', () => {
    render(<TaxiPanel />)
    expect(screen.getByText('승차 포인트: 내 위치 주변에서 호출')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '학교 정문 출발' }))
    expect(screen.getByText('승차 포인트: 정문 앞 로터리')).toBeInTheDocument()
  })

  it('text-mute-2 생색을 사용하지 않는다', () => {
    const { container } = render(<TaxiPanel />)
    expect(container.innerHTML).not.toMatch(/text-mute-2/)
  })
})

// ── D4 — GPS 없음: 막다른 화면 대신 고정 출발지 프리셋으로 동작 ──
import useAppStore from '../../stores/useAppStore'

describe('TaxiPanel — GPS 없음(D4)', () => {
  beforeEach(() => {
    useAppStore.mockImplementation((selector) =>
      selector({
        userLocation: null,
        driveRouteCoords: null,
        setDriveRouteCoords: vi.fn(),
        setUserLocation: vi.fn(),
      }),
    )
  })

  it('"GPS 위치를 켜주세요" 막다른 문구가 없다', () => {
    render(<TaxiPanel />)
    expect(screen.queryByText('GPS 위치를 켜주세요')).not.toBeInTheDocument()
  })

  it('학교 정문 출발 기준으로 목적지·요금 목록을 바로 보여준다', () => {
    render(<TaxiPanel />)
    expect(screen.getByRole('button', { name: '학교 정문 출발' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('정왕역')).toBeInTheDocument()
    expect(screen.getByText('승차 포인트: 정문 앞 로터리')).toBeInTheDocument()
  })

  it('위치 권한 요청 버튼(내 위치 켜기)이 있다', () => {
    render(<TaxiPanel />)
    expect(screen.getByRole('button', { name: /내 위치 켜기/ })).toBeInTheDocument()
  })

  it('정왕역 출발로 바꾸면 학교행 목적지가 보인다', () => {
    render(<TaxiPanel />)
    fireEvent.click(screen.getByRole('button', { name: '정왕역 출발' }))
    expect(screen.getByText('한국공학대(정문)')).toBeInTheDocument()
    expect(screen.getByText('승차 포인트: 정왕역 앞 택시승강장')).toBeInTheDocument()
  })
})
