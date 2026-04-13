import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BusTab from './BusTab'

vi.mock('../../hooks/useBus', () => ({
  useBusStations: () => ({
    data: [
      { station_id: 1, name: '한국공학대학교 정문', lat: 37.34, lng: 126.73, routes: [{ route_number: '330' }, { route_number: '3100' }, { route_number: '시흥33' }] },
      { station_id: 2, name: '한국공학대학교 후문', lat: 37.34, lng: 126.73, routes: [{ route_number: '시흥33' }] },
      { station_id: 3, name: '정왕역', lat: 37.34, lng: 126.72, routes: [{ route_number: '330' }, { route_number: '시흥33' }] },
    ],
    loading: false,
    error: null,
  }),
  useBusArrivals: (stationId) => ({
    data: stationId === 1 ? {
      station_id: 1,
      station_name: '한국공학대학교 정문',
      updated_at: '2026-04-13T14:00:00',
      arrivals: [
        { route_no: '330', destination: '수원역', arrival_type: 'realtime', arrive_in_seconds: 180 },
        { route_no: '시흥33', destination: '정왕역', arrival_type: 'realtime', arrive_in_seconds: 60 },
        { route_no: '20-1', destination: '시화', arrival_type: 'timetable', depart_at: '18:10' },
      ],
    } : stationId === 2 ? {
      station_id: 2,
      station_name: '한국공학대학교 후문',
      updated_at: '2026-04-13T14:00:00',
      arrivals: [
        { route_no: '시흥33', destination: '정왕역', arrival_type: 'realtime', arrive_in_seconds: 300 },
      ],
    } : null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

describe('BusTab', () => {
  it('정류장 목록 렌더링', () => {
    render(<BusTab />)
    expect(screen.getByText('한국공학대학교 정문')).toBeInTheDocument()
    expect(screen.getByText('한국공학대학교 후문')).toBeInTheDocument()
    expect(screen.getAllByText('정왕역')[0]).toBeInTheDocument()
  })

  it('첫 번째 정류장 기본 선택', () => {
    render(<BusTab />)
    expect(screen.getByText('330')).toBeInTheDocument()
  })

  it('정류장 클릭 시 해당 도착정보 표시', () => {
    render(<BusTab />)
    fireEvent.click(screen.getByText('한국공학대학교 후문'))
    expect(screen.getByText('시흥33')).toBeInTheDocument()
  })

  it('시간표 기반 노선은 출발시각 표시', () => {
    render(<BusTab />)
    expect(screen.getByText('18:10 출발')).toBeInTheDocument()
  })
})
