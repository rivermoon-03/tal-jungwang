/**
 * PWAInstallBanner 테스트
 *
 * 시안2 시각 언어 통일 작업에서 고친 세 가지를 검증한다.
 *   - 닫기 버튼(배너 · iOS 모달)이 IconButton(44px 히트영역)을 쓴다
 *   - iOS 모달 카드가 bg-white 고정이 아니라 surface 토큰이라 다크 모드에서
 *     흰 카드가 뜨지 않는다
 *   - top-0 고정 배너가 상단 세이프에어리어(env(safe-area-inset-top))를
 *     padding으로 보정한다
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PWAInstallBanner from './PWAInstallBanner'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

vi.mock('../../hooks/useMediaQuery', () => ({
  useIsDesktop: () => false,
}))

const mockUsePWAInstall = vi.fn()
vi.mock('../../hooks/usePWAInstall', () => ({
  usePWAInstall: (...args) => mockUsePWAInstall(...args),
}))

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    mockUsePWAInstall.mockReset()
  })

  // jsdom의 CSSOM은 env()를 파싱하지 못해 React가 style을 적용할 때 그 선언
  // 자체를 조용히 버린다(렌더 결과의 style 속성에 남지 않는다) — 그래서
  // 렌더 결과가 아니라 소스 문자열로 검증한다.
  it('상단 고정 배너가 상단 세이프에어리어를 padding으로 보정한다', () => {
    const src = fs.readFileSync(path.join(__dirname, 'PWAInstallBanner.jsx'), 'utf8')
    expect(src).toMatch(/paddingTop:\s*['"]env\(safe-area-inset-top\)['"]/)
  })

  it('배너 닫기 버튼이 44px 히트 영역(IconButton)을 갖는다', () => {
    mockUsePWAInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      isDismissed: false,
      isIOS: false,
      promptInstall: vi.fn(),
      dismiss: vi.fn(),
    })
    render(<PWAInstallBanner />)
    const closeBtn = screen.getByRole('button', { name: '배너 닫기' })
    expect(closeBtn.className).toContain('min-h-[44px]')
    expect(closeBtn.className).toContain('min-w-[44px]')
  })

  it('iOS 모달의 닫기 버튼도 44px 히트 영역을 갖고, 카드는 surface 토큰(bg-white 아님)을 쓴다', () => {
    mockUsePWAInstall.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      isDismissed: false,
      isIOS: true,
      promptInstall: vi.fn(),
      dismiss: vi.fn(),
    })
    render(<PWAInstallBanner />)

    fireEvent.click(screen.getByRole('button', { name: '앱 설치하기' }))

    const dialog = screen.getByRole('dialog', { name: 'iOS 홈 화면 추가 안내' })
    const card = dialog.querySelector('.rounded-sheet.p-6')
    expect(card).not.toBeNull()
    expect(card.className).not.toContain('bg-white')
    expect(card.className).toContain('bg-surface')

    const modalCloseBtn = screen.getByRole('button', { name: '닫기' })
    expect(modalCloseBtn.className).toContain('min-h-[44px]')
    expect(modalCloseBtn.className).toContain('min-w-[44px]')
  })
})
