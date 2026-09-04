/**
 * MapViewFallback — MapView 청크(Suspense pending) 자리표시자 테스트.
 *
 * MainShell/PCMainShell이 MapView를 지연 로드로 바꾸면서(2026-09), 청크가
 * 아직 도착하지 않은 순간에도 두 가지가 보장돼야 한다.
 *   1) 지도가 있던 자리가 갑자기 비어 보이지 않는다(로딩 문구).
 *   2) 카카오 SDK가 실패해도 닫기 버튼은 항상 뜬다는 기존 보장(결함 #1)이
 *      MapView 본체조차 아직 없는 이 단계까지 이어진다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MapViewFallback from './MapViewFallback'

describe('MapViewFallback', () => {
  it('로딩 문구를 항상 렌더한다', () => {
    render(<MapViewFallback />)
    expect(screen.getByText('지도를 불러오는 중...')).toBeInTheDocument()
  })

  it('mapExpanded가 아니면 닫기 버튼을 그리지 않는다', () => {
    render(<MapViewFallback mapExpanded={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '지도 닫기' })).not.toBeInTheDocument()
  })

  it('onClose가 없으면 mapExpanded여도 닫기 버튼을 그리지 않는다', () => {
    render(<MapViewFallback mapExpanded />)
    expect(screen.queryByRole('button', { name: '지도 닫기' })).not.toBeInTheDocument()
  })

  it('mapExpanded이고 onClose가 있으면 닫기 버튼이 뜨고 클릭 시 onClose를 부른다', () => {
    const onClose = vi.fn()
    render(<MapViewFallback mapExpanded onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: '지도 닫기' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
