import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'

const THEME_LIGHT = '#ffffff'
const THEME_DARK  = '#000000'

/**
 * useTheme — themeMode에 따라 다크 클래스 + PWA theme-color 동기화.
 *
 * 2026-04-19 리디자인: OLED Pure Black 기준 (#000). coral / headerCollapsed 조건 제거.
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
