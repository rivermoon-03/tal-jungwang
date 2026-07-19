import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NearestStopCard from './NearestStopCard'
import { STATION_COORDS } from '../../hooks/useUserLocation'

const [hakLat, hakLng] = STATION_COORDS['한국공학대']
const [emartLat, emartLng] = STATION_COORDS['이마트']

const HAKGONG_ARRIVALS = {
  arrivals: [
    {
      route_no: '11-A', category: '하교', arrival_type: 'realtime',
      arrive_in_seconds: 190, destination: '정왕역',
    },
    {
      route_no: '20-1', category: '하교', arrival_type: 'timetable',
      depart_at: '15:40', destination: '아이파크',
    },
    // 같은 노선 중복 도착은 첫 건만 남아야 함
    {
      route_no: '11-A', category: '하교', arrival_type: 'realtime',
      arrive_in_seconds: 900, destination: '정왕역',
    },
    // 등교 카테고리는 하교 방향 조회 시 제외되어야 함
    {
      route_no: '시흥33', category: '등교', arrival_type: 'realtime',
      arrive_in_seconds: 300, destination: '학교행',
    },
  ],
}

describe('NearestStopCard — GPS 없음 폴백', () => {
  it('userLocation이 없으면 안내 배너를 보여준다', () => {
    render(<NearestStopCard userLocation={null} direction="하교" onRequestGps={vi.fn()} />)
    expect(screen.getByText(/내 위치를 켜면 가까운 정류장을 보여드려요/)).toBeInTheDocument()
  })

  it('안내 배너 탭 시 onRequestGps가 호출된다', () => {
    const onRequestGps = vi.fn()
    render(<NearestStopCard userLocation={null} direction="하교" onRequestGps={onRequestGps} />)
    fireEvent.click(screen.getByRole('button', { name: '내 위치 켜기' }))
    expect(onRequestGps).toHaveBeenCalledTimes(1)
  })
})

describe('NearestStopCard — 최근접 정류장 선정', () => {
  it('한국공학대 좌표 근처면 한국공학대를 최근접으로 표시한다', () => {
    render(
      <NearestStopCard
        userLocation={{ lat: hakLat, lng: hakLng }}
        direction="하교"
        arrivalsByStation={{ 한국공학대: HAKGONG_ARRIVALS }}
      />
    )
    expect(screen.getByText('한국공학대')).toBeInTheDocument()
  })

  it('현재 방향(하교)과 일치하는 노선만, 최대 2행이 노출된다(중복 노선 제거)', () => {
    render(
      <NearestStopCard
        userLocation={{ lat: hakLat, lng: hakLng }}
        direction="하교"
        arrivalsByStation={{ 한국공학대: HAKGONG_ARRIVALS }}
      />
    )
    expect(screen.getByText('11-A')).toBeInTheDocument()
    expect(screen.getByText('20-1')).toBeInTheDocument()
    // 등교 카테고리 노선은 제외
    expect(screen.queryByText('시흥33')).not.toBeInTheDocument()
  })

  it('실시간 도착은 "N분", 시간표 도착은 출발 시각 기반 라벨을 보여준다', () => {
    render(
      <NearestStopCard
        userLocation={{ lat: hakLat, lng: hakLng }}
        direction="하교"
        arrivalsByStation={{ 한국공학대: HAKGONG_ARRIVALS }}
      />
    )
    // 190초 → 4분(ceil) — formatArrival 헬퍼 결과
    expect(screen.getByText('4분')).toBeInTheDocument()
  })

  it('행 탭 시 onSelectStation이 정류장 shape으로 호출된다', () => {
    const onSelectStation = vi.fn()
    render(
      <NearestStopCard
        userLocation={{ lat: hakLat, lng: hakLng }}
        direction="하교"
        arrivalsByStation={{ 한국공학대: HAKGONG_ARRIVALS }}
        onSelectStation={onSelectStation}
      />
    )
    fireEvent.click(screen.getByText('11-A'))
    expect(onSelectStation).toHaveBeenCalledWith(
      expect.objectContaining({ name: '한국공학대', type: 'bus', primaryStopGbisId: '224000639' })
    )
  })

  it('데이터가 아직 없으면 "도착 정보를 준비 중이에요"를 보여준다', () => {
    render(
      <NearestStopCard
        userLocation={{ lat: hakLat, lng: hakLng }}
        direction="하교"
        arrivalsByStation={{}}
      />
    )
    expect(screen.getByText('도착 정보를 준비 중이에요')).toBeInTheDocument()
  })
})

describe('NearestStopCard — 도보 분 근사', () => {
  it('이마트 좌표 근처면 이마트 기준 도보 분이 1분 이상으로 표시된다', () => {
    render(
      <NearestStopCard
        userLocation={{ lat: emartLat, lng: emartLng }}
        direction="하교"
        arrivalsByStation={{}}
      />
    )
    expect(screen.getByText(/· 도보 \d+분/)).toBeInTheDocument()
  })
})
