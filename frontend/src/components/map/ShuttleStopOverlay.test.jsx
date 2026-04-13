import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ShuttleStopOverlay from './ShuttleStopOverlay'

beforeEach(() => {
  const pos = {}
  window.kakao = {
    maps: {
      LatLng: vi.fn(function () { return pos }),
      Size: vi.fn(function () {}),
      Point: vi.fn(function () {}),
      MarkerImage: vi.fn(function () {}),
      Marker: vi.fn(function () { return { setMap: vi.fn() } }),
      CustomOverlay: vi.fn(function () { return { setMap: vi.fn() } }),
    },
  }
})

vi.mock('../../hooks/useShuttle', () => ({
  useShuttleNext: () => ({ data: null, loading: false, error: null }),
}))

describe('ShuttleStopOverlay', () => {
  it('말풍선 텍스트(셔틀 탑승지)가 DOM에 없어야 한다', () => {
    const map = {}
    const { queryByText } = render(<ShuttleStopOverlay map={map} />)
    expect(queryByText(/셔틀 탑승지/)).toBeNull()
  })

  it('CustomOverlay를 생성하지 않아야 한다', () => {
    const map = {}
    render(<ShuttleStopOverlay map={map} />)
    expect(window.kakao.maps.CustomOverlay).not.toHaveBeenCalled()
  })
})
