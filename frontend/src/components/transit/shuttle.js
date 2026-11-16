import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'

export const SHUTTLE_DIRS = [
  { value: 0, label: '등교', desc: '정왕역 출발' },
  { value: 1, label: '하교', desc: '학교 출발' },
]

export function useShuttleDirection() {
  const { direction } = useEffectiveDirection()
  const chosen = useAppStore((s) => s.shuttleDirection)
  return chosen ?? (direction === '등교' ? 0 : 1)
}

export function shuttleTimes(schedule, dir) {
  return schedule?.directions?.find((d) => d.direction === dir)?.times ?? []
}
