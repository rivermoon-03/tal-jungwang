import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'

const HERO_LIGHT = '#fafafa'
const HERO_DARK = '#1c1f26'
const CORAL = '#FF385C'

/**
 * useTheme — themeMode에 따라 다크모드 클래스와 PWA theme-color를 동기화.
 *
 * Props:
 *   headerCollapsed — Hero가 접혀있으면 theme-color를 coral로 설정
 */
export function useTheme({ headerCollapsed = false } = {}) {
  const themeMode  = useAppStore((s) => s.themeMode)
  const setStore   = useAppStore.setState

  useEffect(() => {
    const applyTheme = (prefersDark) => {
      const isDark =
        themeMode === 'dark' || (themeMode === 'system' && prefersDark)
      document.documentElement.classList.toggle('dark', isDark)

      // 레거시 darkMode 필드 동기화
      setStore({ darkMode: isDark })

      // PWA theme-color 동기화
      const heroBg = isDark ? HERO_DARK : HERO_LIGHT
      const themeColor = headerCollapsed ? CORAL : heroBg
      let meta = document.querySelector('meta[name="theme-color"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', themeColor)
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
  }, [themeMode, headerCollapsed, setStore])
}
