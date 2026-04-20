// frontend/src/hooks/useTrafficFlow.js
import { useApi } from './useApi'

export function useTrafficFlow(dayType = 'weekday') {
  return useApi(`/traffic/flow?day_type=${dayType}`)
}
