import { useEffect, useRef } from 'react'

/** 코어 4개 이하나 메모리 4GB 이하 기기는 움직이는 필터와 입자를 끈다. */
export function isLowEnd(nav = typeof navigator === 'undefined' ? {} : navigator) {
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
}

/**
 * 날씨 배경의 CSS 애니메이션과 SVG 필터 애니메이션을 탭이 숨었거나 화면 밖일 때 멈춘다.
 * 루트 요소에 data-paused 를 붙이고, SVG 는 pauseAnimations() 로 멈춘다.
 */
export function useWeatherMotion() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let visible = true
    const apply = () => {
      const paused = document.hidden || !visible
      el.toggleAttribute('data-paused', paused)
      el.querySelectorAll('svg').forEach((svg) => (paused ? svg.pauseAnimations?.() : svg.unpauseAnimations?.()))
    }
    const io = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting
          apply()
        })
    io?.observe(el)
    document.addEventListener('visibilitychange', apply)
    return () => {
      io?.disconnect()
      document.removeEventListener('visibilitychange', apply)
    }
  }, [])

  return ref
}
