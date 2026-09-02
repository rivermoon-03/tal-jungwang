/**
 * useTheme — PWA theme-color 가 앱 배경과 어긋나지 않는지 고정한다.
 *
 * theme-color 는 OS 상태바/브라우저 크롬 색이다. 앱 배경(--tj-bg)과 다른 값을
 * 넣으면 화면 위아래 가장자리에 색 경계가 그대로 보인다. 예전에는 다크가
 * OLED 순검정(#000)이었는데 DESIGN.md §6 에서 순검정을 폐기하고 sage 사다리로
 * 옮긴 뒤에도 이 상수만 남아, 다크로 들어갈 때마다 검은 띠가 생겼다.
 */
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTheme } from './useTheme'

let storeState = {}
const setStateMock = vi.fn((patch) => Object.assign(storeState, patch))

vi.mock('../stores/useAppStore', () => {
  const hook = vi.fn((selector) => selector(storeState))
  hook.setState = (patch) => setStateMock(patch)
  return { default: hook }
})

// index.css 의 --tj-bg 라이트/다크 값. 여기가 바뀌면 useTheme 상수도 같이 바뀌어야 한다.
const BG_LIGHT = '#fbfdfc'
const BG_DARK = '#101211'

function themeColor() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
}

describe('useTheme — theme-color', () => {
  beforeEach(() => {
    storeState = { themeMode: 'light' }
    document.querySelector('meta[name="theme-color"]')?.remove()
    document.documentElement.classList.remove('dark')
    vi.stubGlobal('matchMedia', (query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('라이트: theme-color 가 --tj-bg 라이트 값과 같다', () => {
    storeState.themeMode = 'light'
    renderHook(() => useTheme())
    expect(themeColor()).toBe(BG_LIGHT)
  })

  it('다크: theme-color 가 --tj-bg 다크 값과 같다 (순검정 아님)', () => {
    storeState.themeMode = 'dark'
    renderHook(() => useTheme())
    expect(themeColor()).toBe(BG_DARK)
    expect(themeColor()).not.toBe('#000000')
  })

  it('다크에서 html 에 dark 클래스가 붙는다', () => {
    storeState.themeMode = 'dark'
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('system 모드는 OS 설정을 따른다', () => {
    storeState.themeMode = 'system'
    vi.stubGlobal('matchMedia', (query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    renderHook(() => useTheme())
    expect(themeColor()).toBe(BG_DARK)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('meta 태그가 없으면 만들어 붙인다', () => {
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull()
    storeState.themeMode = 'light'
    renderHook(() => useTheme())
    expect(document.querySelector('meta[name="theme-color"]')).not.toBeNull()
  })
})
