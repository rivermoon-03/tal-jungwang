/**
 * DirectionAutoToast — 자동 방향 전환 토스트 테스트
 *
 * 토스트 렌더링, "되돌리기" 액션, 자동 닫힘, 트랜지션 상태를 검증한다.
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import DirectionAutoToast from './DirectionAutoToast'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── 스토어 모킹 ──
const mockSetDirectionOverride = vi.fn()
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      setDirectionOverride: mockSetDirectionOverride,
    }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  mockSetDirectionOverride.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DirectionAutoToast', () => {
  it('visible이 false면 렌더하지 않는다', () => {
    render(
      <DirectionAutoToast
        message="오후라서 하교로 전환했어요"
        previousDirection="등교"
        visible={false}
        onClose={() => {}}
      />,
    )

    expect(screen.queryByText('오후라서 하교로 전환했어요')).not.toBeInTheDocument()
  })

  it('visible이 true면 문구와 "되돌리기" 버튼을 렌더한다', () => {
    render(
      <DirectionAutoToast
        message="오후라서 하교로 전환했어요"
        previousDirection="등교"
        visible={true}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('오후라서 하교로 전환했어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeInTheDocument()
  })

  // FloatingDock(z-nav)과 같은 z-50을 공유해 내비와 토스트가 같은 층에
  // 있었다 — z-toast 토큰으로 분리해 토스트가 항상 내비 위에 뜨게 한다.
  it('z-toast 토큰을 사용한다(z-50 임의값 아님)', () => {
    const { container } = render(
      <DirectionAutoToast
        message="오후라서 하교로 전환했어요"
        previousDirection="등교"
        visible={true}
        onClose={() => {}}
      />,
    )
    const toast = container.firstChild
    expect(toast.className).toContain('z-toast')
    expect(toast.className).not.toMatch(/\bz-50\b/)
  })

  // FloatingDock처럼 margin-bottom으로 하단 세이프에어리어를 더한다 — 없으면
  // 홈 인디케이터가 있는 기기에서 토스트가 화면 밖으로 밀린다.
  // jsdom의 CSSOM은 env()를 파싱하지 못해 React가 style을 적용할 때 그 선언
  // 자체를 조용히 버린다(el.style.marginBottom도, style 속성 원문도 비어
  // 남는다) — 그래서 렌더 결과가 아니라 소스 문자열로 검증한다.
  it('하단 세이프에어리어(env(safe-area-inset-bottom))를 보정한다', () => {
    const src = fs.readFileSync(path.join(__dirname, 'DirectionAutoToast.jsx'), 'utf8')
    expect(src).toMatch(/marginBottom:\s*['"]env\(safe-area-inset-bottom\)['"]/)
  })

  it('"되돌리기" 버튼 클릭 시 setDirectionOverride를 이전 방향으로 호출한다', () => {
    const onClose = vi.fn()
    render(
      <DirectionAutoToast
        message="오후라서 하교로 전환했어요"
        previousDirection="등교"
        visible={true}
        onClose={onClose}
      />,
    )

    const undoButton = screen.getByRole('button', { name: '되돌리기' })
    fireEvent.click(undoButton)

    expect(mockSetDirectionOverride).toHaveBeenCalledWith('등교')
  })

  it('4초 후 자동으로 onClose를 호출한다', () => {
    const onClose = vi.fn()
    render(
      <DirectionAutoToast
        message="오후라서 하교로 전환했어요"
        previousDirection="등교"
        visible={true}
        onClose={onClose}
      />,
    )

    expect(onClose).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    // 4초 후 isLeaving 상태가 설정되지만 아직 160ms 타이머는 실행 안 됨
    expect(onClose).not.toHaveBeenCalled()

    // 추가 160ms로 퇴장 애니메이션 완료
    act(() => {
      vi.advanceTimersByTime(160)
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('"되돌리기" 클릭 후 퇴장 모션(160ms) 동안 opacity가 0으로 변경되고 onClose를 호출한다', () => {
    const onClose = vi.fn()
    const { container } = render(
      <DirectionAutoToast
        message="오후라서 하교로 전환했어요"
        previousDirection="등교"
        visible={true}
        onClose={onClose}
      />,
    )

    const undoButton = screen.getByRole('button', { name: '되돌리기' })
    fireEvent.click(undoButton)

    act(() => {
      vi.advanceTimersByTime(0)
    })

    // 퇴장 직후: DOM에 여전히 있지만 opacity=0
    expect(container.querySelector('div')).toHaveClass('opacity-0')
    expect(onClose).not.toHaveBeenCalled()

    // 160ms 후: onClose 호출
    act(() => {
      vi.advanceTimersByTime(160)
    })

    expect(onClose).toHaveBeenCalled()
  })
})
