/**
 * Sheet — bottom 배치 하단 패딩.
 *
 * 예전엔 결함 #8(셔틀 상세 모달 마지막 행이 독 뒤에 가려짐)을 막으려고 모바일
 * bottom 배치에 DOCK_RESERVED_PX(76px)를 더 비웠다. 그런데 시트(z-sheet)와
 * 백드롭(z-overlay)은 독(z-nav)보다 위에 그려지므로 독은 시트가 열린 동안
 * 눌리지도 보이지도 않는다. 그 76px은 마커 시트 액션 버튼 아래 흰 띠(실측
 * 100px)로만 남았다. 이제 bottom 배치는 safe-area와 작은 고정 여백만 비우고,
 * PC와 모바일을 구분하지 않는다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sheet from './Sheet'
import { DOCK_RESERVED_PX } from '../common/FloatingDock'

function stubDesktop(matches) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
}

describe('Sheet — bottom 배치 하단 패딩은 독 높이를 비우지 않는다', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('모바일 bottom 배치는 safe-area와 작은 고정 여백만 비운다', () => {
    stubDesktop(false)
    render(
      <Sheet open onClose={vi.fn()} label="테스트 시트" placement="bottom">
        <p>내용</p>
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    // jsdom의 CSSOM이 단독 env()를 못 파싱하므로 style 속성 원문으로 비교한다.
    const style = dialog.getAttribute('style') ?? ''
    expect(style).toMatch(/padding-bottom: calc\(\d+px \+ env\(safe-area-inset-bottom\)\)/)
    expect(style).not.toContain(String(DOCK_RESERVED_PX))
  })

  it('PC bottom 배치도 같은 여백을 쓴다(독 유무와 무관)', () => {
    stubDesktop(true)
    render(
      <Sheet open onClose={vi.fn()} label="테스트 시트" placement="bottom">
        <p>내용</p>
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    const style = dialog.getAttribute('style') ?? ''
    expect(style).toMatch(/padding-bottom: calc\(\d+px \+ env\(safe-area-inset-bottom\)\)/)
    expect(style).not.toContain(String(DOCK_RESERVED_PX))
  })

  it('center 배치는 paddingBottom을 아예 설정하지 않는다', () => {
    stubDesktop(false)
    render(
      <Sheet open onClose={vi.fn()} label="테스트 시트" placement="center">
        <p>내용</p>
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.paddingBottom).toBe('')
  })
})
