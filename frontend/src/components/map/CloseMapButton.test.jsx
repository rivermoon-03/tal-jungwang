/**
 * CloseMapButton — MapView.jsx에서 뽑아낸 독립 컴포넌트.
 *
 * MapView 본체(카카오 SDK 연동)를 지연 로드로 바꾸면서, 청크가 아직 없는
 * MapViewFallback에서도 같은 닫기 버튼을 그려야 했다 — MapView.jsx 안에 갇혀
 * 있던 지역 함수로는 그럴 수 없어 별도 파일로 뽑았다. 렌더/클릭 계약만 고정한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CloseMapButton from './CloseMapButton'

describe('CloseMapButton', () => {
  it('"지도 닫기" 접근성 이름으로 렌더된다', () => {
    render(<CloseMapButton onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '지도 닫기' })).toBeInTheDocument()
  })

  it('클릭하면 onClose를 정확히 한 번 부른다', () => {
    const onClose = vi.fn()
    render(<CloseMapButton onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '지도 닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
