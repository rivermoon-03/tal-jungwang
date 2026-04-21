// frontend/src/hooks/useTrafficLive.js
// /api/v1/traffic를 폴링해 지정 도로·방향의 현재 속도를 반환한다.
import { useMemo } from 'react'
import { useApi } from './useApi'

export function useTrafficLive(
  roadName = '마유로',
  direction = 'to_school',
  { interval = 30000 } = {},
) {
  const { data, loading, error, fetchedAt } = useApi('/traffic', { interval })
  const road = useMemo(() => {
    if (!data?.roads) return null
    return (
      data.roads.find(
        (r) => r.road_name === roadName && r.direction === direction,
      ) ?? null
    )
  }, [data, roadName, direction])
  return { road, loading, error, fetchedAt }
}
