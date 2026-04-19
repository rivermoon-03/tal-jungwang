import { useCallback, useRef } from 'react'
import useAppStore from '../stores/useAppStore'

/**
 * useSnap — 2단 스냅(지도 ↔ 대시보드) 상태와 제스처 훅.
 *
 * snapMode: 'default' | 'dashboard' | 'map'
 *   - default   → map 40%, dashboard 60%
 *   - dashboard → map  0%, dashboard 100%
 *   - map       → map 100%, dashboard  0%
 *
 * 반환:
 *   { mode, setMode, heights, handlers }
 *   heights = { map: number(%), dashboard: number(%) }
 *   handlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
 *
 * 제스처:
 *   pointerdown 기준 deltaY(누적)를 측정한다.
 *   |deltaY| > THRESHOLD(60px) 일 때 방향에 따라 snap 전환한다.
 *     - 위로 스와이프(deltaY < -60): default→dashboard, map→default
 *     - 아래로 스와이프(deltaY >  60): default→map,      dashboard→default
 *
 * prefers-reduced-motion 에서도 동일하게 동작한다.
 * (CSS 전환 duration이 0ms가 되어 즉시 전환될 뿐 로직은 동일.)
 */
const HEIGHTS = {
  default:   { map: 40,  dashboard: 60  },
  dashboard: { map:  0,  dashboard: 100 },
  map:       { map: 100, dashboard: 0   },
}

const THRESHOLD_PX = 60

function nextUp(mode) {
  // 위로 스와이프 = 대시보드를 더 키운다
  if (mode === 'map') return 'default'
  if (mode === 'default') return 'dashboard'
  return 'dashboard'
}

function nextDown(mode) {
  // 아래로 스와이프 = 지도를 더 키운다
  if (mode === 'dashboard') return 'default'
  if (mode === 'default') return 'map'
  return 'map'
}

export function useSnap() {
  const mode = useAppStore((s) => s.snapMode)
  const setMode = useAppStore((s) => s.setSnapMode)

  const heights = HEIGHTS[mode] ?? HEIGHTS.default

  const startYRef = useRef(null)
  const consumedRef = useRef(false)

  const onPointerDown = useCallback((e) => {
    startYRef.current = e.clientY ?? e.touches?.[0]?.clientY ?? null
    consumedRef.current = false
  }, [])

  const onPointerMove = useCallback((e) => {
    if (startYRef.current == null || consumedRef.current) return
    const currentY = e.clientY ?? e.touches?.[0]?.clientY
    if (currentY == null) return
    const deltaY = currentY - startYRef.current
    if (Math.abs(deltaY) <= THRESHOLD_PX) return

    // 임계값을 처음 넘기는 순간 한 번만 전환한다
    consumedRef.current = true
    const currentMode = useAppStore.getState().snapMode
    if (deltaY < 0) {
      setMode(nextUp(currentMode))
    } else {
      setMode(nextDown(currentMode))
    }
  }, [setMode])

  const onPointerUp = useCallback(() => {
    startYRef.current = null
    consumedRef.current = false
  }, [])

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }

  return { mode, setMode, heights, handlers }
}

export default useSnap
