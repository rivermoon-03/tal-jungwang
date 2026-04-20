// frontend/src/hooks/useNowDepartures.js
import { useApi } from './useApi'
import useAppStore from '../stores/useAppStore'

export function useNowDepartures() {
  const mode         = useAppStore((s) => s.commuteMode)
  const destCode     = useAppStore((s) => s.selectedDestinationCode)
  const subwayStop   = useAppStore((s) => s.selectedSubwayStation)

  const params = new URLSearchParams({ mode })
  if (mode === '하교')   params.set('destination',    destCode)
  if (mode === '지하철') params.set('subway_station', subwayStop)

  return useApi(`/now/departures?${params.toString()}`, {
    interval: 30_000,
  })
}
