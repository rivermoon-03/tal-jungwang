import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'

// SettingsPage 슬라이더 값(0/1/2) → 실제 배율. 1(보통)은 항상 1.0으로 고정해
// 기존 화면의 기준 크기를 바꾸지 않는다.
const SCALE_BY_STEP = { 0: 0.92, 1: 1, 2: 1.15 }

/**
 * useFontScale — fontScale(0/1/2)을 --tj-font-scale CSS 변수로 반영.
 * tailwind.config.js의 fontSize 스케일 전체가 calc(Npx * var(--tj-font-scale,1))라
 * 이 값 하나로 앱 텍스트 대부분의 크기가 함께 커지거나 작아진다.
 */
export function useFontScale() {
  const fontScale = useAppStore((s) => s.fontScale)

  useEffect(() => {
    const scale = SCALE_BY_STEP[fontScale] ?? 1
    document.documentElement.style.setProperty('--tj-font-scale', String(scale))
  }, [fontScale])
}
