/**
 * WeatherCard — fetch 중 로딩 스켈레톤 회귀 테스트.
 *
 * 결함: weather가 아직 없을 때(fetch 중) 값 없는 빈 카드가 그대로 그려졌다.
 * 지금은 weather===null이면 카드와 같은 골격(헤더 두 줄 + ChartSkeleton)의
 * 스켈레톤을 대신 그린다 — 이 파일은 그 분기와, weather가 채워진 뒤 정상
 * 렌더로 전환되는지를 함께 고정한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import WeatherCard from './WeatherCard'

const mockUseWeather = vi.fn()
vi.mock('../../hooks/useWeather', () => ({
  useWeather: (...args) => mockUseWeather(...args),
}))

const mockUseApi = vi.fn()
vi.mock('../../hooks/useApi', () => ({
  useApi: (...args) => mockUseApi(...args),
}))

beforeEach(() => {
  mockUseApi.mockReturnValue({ data: null })
})

describe('WeatherCard — 로딩 상태', () => {
  it('weather가 없으면(fetch 중) 값 없는 빈 카드 대신 스켈레톤을 렌더한다', () => {
    mockUseWeather.mockReturnValue({ weather: null })

    render(<WeatherCard />)

    expect(screen.getByRole('status', { name: '날씨 정보를 불러오는 중' })).toBeInTheDocument()
    // 로딩 중엔 실제 값(제목/온도)이 아직 없다.
    expect(screen.queryByText('오늘 기온 추이')).not.toBeInTheDocument()
  })

  it('weather가 채워지면 스켈레톤 대신 실제 카드를 렌더한다', () => {
    mockUseWeather.mockReturnValue({
      weather: { currentTemp: 21, rainProb: 10, nextTemps: [] },
    })

    render(<WeatherCard />)

    expect(screen.queryByRole('status', { name: '날씨 정보를 불러오는 중' })).not.toBeInTheDocument()
    expect(screen.getByText('오늘 기온 추이')).toBeInTheDocument()
  })
})
