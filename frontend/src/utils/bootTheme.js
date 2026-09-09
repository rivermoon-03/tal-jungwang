/**
 * React 마운트 전에 dark 클래스를 확정한다.
 *
 * useTheme 은 useEffect 에서 돌아 첫 페인트 뒤에 적용된다. 그 사이 한 프레임을
 * 라이트로 그리면 다크 사용자에게 흰 화면이 번쩍인다. 그래서 부팅 시점에
 * persist 된 값을 직접 읽어 같은 판정을 미리 한 번 한다.
 *
 * 판정 근거는 zustand persist blob 하나여야 한다. 이 자리에서 별도 키를 읽으면
 * 그 키를 쓰는 코드가 사라졌을 때 조용히 기본값으로 떨어진다.
 */

// stores/useAppStore.js 의 persist name 과 같아야 한다.
export const PERSIST_KEY = 'tal-jungwang'

const VALID_MODES = ['light', 'dark', 'system']

/** persist blob 문자열에서 themeMode 를 꺼낸다. 없거나 깨졌으면 'system'. */
export function readThemeMode(raw) {
  if (!raw) return 'system'
  try {
    const mode = JSON.parse(raw)?.state?.themeMode
    return VALID_MODES.includes(mode) ? mode : 'system'
  } catch {
    return 'system'
  }
}

/** useTheme 의 판정과 같은 규칙이다. 두 곳이 어긋나면 부팅 직후 테마가 한 번 튄다. */
export function resolveIsDark(mode, prefersDark) {
  return mode === 'dark' || (mode === 'system' && Boolean(prefersDark))
}

export function applyBootTheme() {
  let raw = null
  try {
    raw = localStorage.getItem(PERSIST_KEY)
  } catch {
    // 시크릿 모드나 저장소 차단. 시스템 설정만 보고 판정한다.
  }

  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  document.documentElement.classList.toggle(
    'dark',
    resolveIsDark(readThemeMode(raw), prefersDark),
  )
}
