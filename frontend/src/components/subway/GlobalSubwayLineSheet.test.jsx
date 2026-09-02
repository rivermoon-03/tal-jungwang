/**
 * GlobalSubwayLineSheet — 모바일 경로가 ui/Sheet로 이관됐는지 회귀 검증.
 *
 * 예전엔 vaul(Drawer)을 직접 다뤄 Escape 처리·백드롭·z-index가 다른 시트들과
 * 갈렸다. 이제 ui/Sheet에 위임하므로 Sheet가 보장하는 Escape 닫힘·포커스 트랩·
 * 배경 탭 닫힘이 이 화면에서도 그대로 동작하는지 확인한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let lineSheetItem = null
const close = vi.fn()

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      subwayLineSheet: lineSheetItem,
      closeSubwayLineSheet: close,
      darkMode: false,
    }),
}))

// jsdom에는 실제 노선도를 그릴 필요가 없다 — Sheet 배선만 검증한다.
vi.mock('./SubwayLineMap', () => ({
  default: () => <div data-testid="line-map" />,
}))

let isDesktop = false
vi.mock('../../hooks/useMediaQuery', () => ({
  useIsDesktop: () => isDesktop,
}))

import GlobalSubwayLineSheet from './GlobalSubwayLineSheet'

const ITEM = {
  line: '수인분당선',
  direction: '상행',
  color: '#F5A623',
  current_station: '정왕',
  destination: '오이도',
  train_no: '1234',
}

beforeEach(() => {
  isDesktop = false
  lineSheetItem = null
  close.mockClear()
})

describe('GlobalSubwayLineSheet — 모바일(Sheet)', () => {
  it('닫혀 있으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<GlobalSubwayLineSheet />)
    expect(container).toBeEmptyDOMElement()
  })

  it('열리면 dialog로 렌더링되고 노선도를 보여준다', () => {
    lineSheetItem = ITEM
    render(<GlobalSubwayLineSheet />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('line-map')).toBeInTheDocument()
  })

  it('Escape를 누르면 닫힌다(Sheet가 처리)', () => {
    lineSheetItem = ITEM
    render(<GlobalSubwayLineSheet />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('배경(백드롭)을 클릭하면 닫힌다', () => {
    lineSheetItem = ITEM
    const { container } = render(<GlobalSubwayLineSheet />)
    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('닫기 버튼이 44px 히트 영역(IconButton)을 갖는다', () => {
    lineSheetItem = ITEM
    render(<GlobalSubwayLineSheet />)
    const closeBtn = screen.getByRole('button', { name: '닫기' })
    expect(closeBtn.className).toMatch(/min-h-\[44px\]/)
    expect(closeBtn.className).toMatch(/min-w-\[44px\]/)
  })
})

describe('GlobalSubwayLineSheet — PC 도킹 패널', () => {
  it('PC에서는 드래그 손잡이를 그리지 않는다(showGrip 상당 — 예전 버그 재발 방지)', () => {
    isDesktop = true
    lineSheetItem = ITEM
    const { container } = render(<GlobalSubwayLineSheet />)
    // 모바일 그립(w-11 h-1 rounded-full)이 PC 분기에는 없어야 한다.
    expect(container.querySelector('.w-11.h-1.rounded-full')).toBeNull()
  })

  it('PC에서는 dialog(백드롭이 있는 모달)로 렌더링되지 않는다 — 도킹 패널이다', () => {
    isDesktop = true
    lineSheetItem = ITEM
    render(<GlobalSubwayLineSheet />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
