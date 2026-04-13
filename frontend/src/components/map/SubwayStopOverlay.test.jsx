import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SubwayStopOverlay from './SubwayStopOverlay'

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

describe('SubwayStopOverlay', () => {
  it('말풍선 텍스트(정왕역)가 DOM에 없어야 한다', () => {
    const map = {}
    const { queryByText } = render(<SubwayStopOverlay map={map} />)
    expect(queryByText(/정왕역/)).toBeNull()
  })

  it('CustomOverlay를 생성하지 않아야 한다', () => {
    const map = {}
    render(<SubwayStopOverlay map={map} />)
    expect(window.kakao.maps.CustomOverlay).not.toHaveBeenCalled()
  })
})
