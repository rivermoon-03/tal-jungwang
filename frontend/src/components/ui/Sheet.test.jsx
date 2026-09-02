/**
 * Sheet — 결함 #8: 바텀 시트 하단이 FloatingDock에 잘리던 결함.
 *
 * bottom placement의 paddingBottom이 env(safe-area-inset-bottom)만 비워서,
 * bottom-[14px]에 떠 있는 FloatingDock의 실제 높이(DOCK_RESERVED_PX)는 그대로
 * 남아 있었다 — 셔틀 상세 모달을 끝까지 내리면 마지막 시(hour) 그룹 헤더가
 * 독 뒤에 깔려 안 보였다. 모바일(bottom + !isDesktop)에서만 DOCK_RESERVED_PX를
 * 더 얹는지, PC(FloatingDock 자체가 없음)와 center 배치에서는 안 더하는지를
 * 검증한다.
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

describe('Sheet — bottom 배치 하단 패딩이 독 높이를 비운다(결함 #8)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('모바일(bottom + !isDesktop)에서는 DOCK_RESERVED_PX만큼 패딩을 더한다', () => {
    stubDesktop(false)
    render(
      <Sheet open onClose={vi.fn()} label="테스트 시트" placement="bottom">
        <p>내용</p>
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    // jsdom의 CSSOM(cssstyle)이 단독 env()를 못 파싱해 style.paddingBottom이
    // 조용히 빈 문자열로 남는 경우가 있어(calc() 안에 감싸면 통과), style
    // 속성 원문 문자열로 직접 비교한다.
    expect(dialog.getAttribute('style')).toContain(
      `padding-bottom: calc(${DOCK_RESERVED_PX}px + env(safe-area-inset-bottom))`
    )
  })

  it('PC(isDesktop)에서는 FloatingDock이 없으므로 safe-area만 비운다', () => {
    stubDesktop(true)
    render(
      <Sheet open onClose={vi.fn()} label="테스트 시트" placement="bottom">
        <p>내용</p>
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    // jsdom의 CSSOM은 calc()로 감싸지 않은 단독 env()를 아예 못 파싱해 style
    // 속성 자체가 비므로(첫 테스트의 calc() 케이스와 다름), 여기서는 독 예약
    // 여백(DOCK_RESERVED_PX)이 안 붙는지만 확인한다 — PC엔 FloatingDock이
    // 없으므로 이 값이 paddingBottom에 섞이면 안 된다는 게 이 테스트의 요지다.
    expect(dialog.getAttribute('style') ?? '').not.toContain(String(DOCK_RESERVED_PX))
  })

  it('center 배치는 독과 무관해 paddingBottom을 아예 설정하지 않는다', () => {
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
