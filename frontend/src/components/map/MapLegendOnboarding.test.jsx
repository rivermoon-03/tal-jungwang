/**
 * MapLegendOnboarding — 마커 색 범례 테스트
 *
 * 마커 색이 무엇을 뜻하는지 앱 어디에도 답이 없던 문제를 채우는 표(색 스와치 +
 * 글리프 + 이름)가 실제로 렌더되는지, 그리고 색이 하드코딩 hex가 아니라
 * lineColor.js(tjLineColor)를 거친 CSS 변수인지 확인한다.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapLegendOnboarding from './MapLegendOnboarding'

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: '지도 표시 안내' }))
}

describe('MapLegendOnboarding — 마커 색 범례', () => {
  it('버튼을 탭하면 "마커 색" 표가 펼쳐진다', () => {
    render(<MapLegendOnboarding />)
    expect(screen.queryByText('마커 색')).not.toBeInTheDocument()
    openPanel()
    expect(screen.getByText('마커 색')).toBeInTheDocument()
  })

  it('버스 · 서울행 버스 · 셔틀 · 4호선 · 수인분당 · 서해선 6개 항목이 모두 렌더된다', () => {
    render(<MapLegendOnboarding />)
    openPanel()
    for (const label of ['버스', '서울행 버스', '셔틀', '4호선', '수인분당', '서해선']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('마커 색 스와치는 하드코딩 hex가 아니라 lineColor.js의 CSS 변수를 쓴다', () => {
    const { container } = render(<MapLegendOnboarding />)
    openPanel()
    const swatches = container.querySelectorAll('[aria-hidden="true"][style*="background: var(--line-"]')
    // 마커 범례 6개 + 기존 LEGEND_ITEMS 스와치는 --tj- 변수라 이 셀렉터에 안 걸림
    expect(swatches.length).toBe(6)
  })

  it('닫기 버튼(IconButton)을 누르면 패널이 닫힌다', () => {
    render(<MapLegendOnboarding />)
    openPanel()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
