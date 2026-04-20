// frontend/src/hooks/useDestinations.js
import { useApi } from './useApi'

export function useDestinations() {
  return useApi('/destinations')
}
