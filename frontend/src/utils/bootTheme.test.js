import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readThemeMode, resolveIsDark, applyBootTheme, PERSIST_KEY } from './bootTheme'

function persistBlob(themeMode) {
  return JSON.stringify({ state: { themeMode, fontScale: 1 }, version: 8 })
}

function mockPrefersDark(matches) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches, addEventListener() {}, removeEventListener() {} })))
}

describe('readThemeMode', () => {
  it('persist blob 에서 themeMode 를 꺼낸다', () => {
    expect(readThemeMode(persistBlob('dark'))).toBe('dark')
    expect(readThemeMode(persistBlob('light'))).toBe('light')
  })

  it('값이 없거나 깨졌으면 system 으로 떨어진다', () => {
    expect(readThemeMode(null)).toBe('system')
    expect(readThemeMode('')).toBe('system')
    expect(readThemeMode('{not json')).toBe('system')
    expect(readThemeMode('{"state":{}}')).toBe('system')
    expect(readThemeMode(persistBlob('neon'))).toBe('system')
  })
})

describe('resolveIsDark', () => {
  it('명시 선택은 시스템 설정을 무시한다', () => {
    expect(resolveIsDark('dark', false)).toBe(true)
    expect(resolveIsDark('light', true)).toBe(false)
  })

  it('system 은 시스템 설정을 따른다', () => {
    expect(resolveIsDark('system', true)).toBe(true)
    expect(resolveIsDark('system', false)).toBe(false)
  })
})

describe('applyBootTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('저장된 dark 를 첫 페인트 전에 반영한다', () => {
    localStorage.setItem(PERSIST_KEY, persistBlob('dark'))
    mockPrefersDark(false)
    applyBootTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('저장된 light 는 시스템이 다크여도 라이트로 둔다', () => {
    localStorage.setItem(PERSIST_KEY, persistBlob('light'))
    mockPrefersDark(true)
    applyBootTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('저장값이 없으면 시스템 설정을 따른다', () => {
    mockPrefersDark(true)
    applyBootTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('localStorage 접근이 막혀도 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    mockPrefersDark(true)
    expect(() => applyBootTheme()).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    spy.mockRestore()
  })

  it('useTheme 과 같은 키를 읽는다 — 쓰는 코드가 없는 키를 읽으면 항상 라이트가 된다', () => {
    localStorage.setItem('tal_dark', '1')
    localStorage.setItem(PERSIST_KEY, persistBlob('dark'))
    mockPrefersDark(false)
    applyBootTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
