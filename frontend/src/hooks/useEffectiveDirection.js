import useAppStore from '../stores/useAppStore'

/**
 * useEffectiveDirection — 현재 유효한 버스 방향(등교/하교)을 반환.
 *
 * 규칙:
 *   effectiveDirection =
 *     directionOverride ?? (new Date().getHours() < 14 ? '등교' : '하교')
 *
 * - 14시를 경계로 자동 전환 (자정~13시 → '등교', 14시~23시 → '하교')
 * - `directionOverride`는 Zustand in-memory 상태 (persist 제외)이므로
 *   새로고침/세션 재시작 시 자동 모드로 복귀한다.
 *
 * 반환 shape:
 *   { direction: '등교' | '하교', isOverride: boolean }
 *
 * 컴포넌트가 자연스럽게 리렌더될 때마다 `new Date()`를 다시 계산하므로
 * 별도의 tick 타이머 없이도 상태 변경에 맞춰 정확한 값이 노출된다.
 */
export default function useEffectiveDirection() {
  const override = useAppStore((s) => s.directionOverride)
  if (override) return { direction: override, isOverride: true }
  const hour = new Date().getHours()
  const direction = hour < 14 ? '등교' : '하교'
  return { direction, isOverride: false }
}
