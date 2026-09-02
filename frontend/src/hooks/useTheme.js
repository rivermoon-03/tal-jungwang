import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'

// PWA theme-color 는 OS 상태바/브라우저 크롬 색이다. 앱 배경(--tj-bg)과 다른 값을
// 넣으면 화면 위아래 가장자리에 색 경계가 그대로 보인다.
// 예전에는 다크를 OLED 순검정(#000)으로 뒀는데, DESIGN.md §6 에서 순검정을 폐기하고
// sage 사다리(#101211)로 옮긴 뒤에도 이 상수만 남아 매 다크 진입마다 검은 띠가 생겼다.
// 두 값은 index.css 의 --tj-bg 라이트/다크와 항상 같아야 한다.
const THEME_LIGHT = '#fbfdfc'
const THEME_DARK  = '#101211'

/**
 * useTheme — themeMode에 따라 다크 클래스 + PWA theme-color 동기화.
 */
export function useTheme() {
  const themeMode = useAppStore((s) => s.themeMode)
  const setStore  = useAppStore.setState

  useEffect(() => {
    const applyTheme = (prefersDark) => {
      const isDark =
        themeMode === 'dark' || (themeMode === 'system' && prefersDark)
      document.documentElement.classList.toggle('dark', isDark)

      // 레거시 darkMode 필드 동기화 (하위호환)
      setStore({ darkMode: isDark })

      // PWA theme-color
      const color = isDark ? THEME_DARK : THEME_LIGHT
      let meta = document.querySelector('meta[name="theme-color"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', color)
    }

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches)
      const handler = (e) => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      applyTheme(themeMode === 'dark')
    }
  }, [themeMode, setStore])
}
