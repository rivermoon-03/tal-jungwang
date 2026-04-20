// frontend/src/hooks/useCommuteMode.js
import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'

/**
 * Timetable for auto-detection:
 *   04:00–11:29  → 등교
 *   11:30–19:29  → 하교
 *   19:30–03:59  → 지하철 (quiet hours — subway is main option home)
 * User override persists until local midnight.
 */
function autoMode(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes()
  if (m >= 4 * 60 && m < 11 * 60 + 30) return '등교'
  if (m >= 11 * 60 + 30 && m < 19 * 60 + 30) return '하교'
  return '지하철'
}

export function useCommuteMode() {
  const mode           = useAppStore((s) => s.commuteMode)
  const override       = useAppStore((s) => s.commuteModeOverride)
  const setCommuteMode = useAppStore((s) => s.setCommuteMode)
  const clearOverride  = useAppStore((s) => s.clearCommuteOverride)

  // On mount: if no override, align with auto
  useEffect(() => {
    if (override) return
    const auto = autoMode()
    if (auto !== mode) useAppStore.setState({ commuteMode: auto })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear override at local midnight
  useEffect(() => {
    if (!override) return
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const ms = tomorrow - now
    const t = setTimeout(() => clearOverride(), ms)
    return () => clearTimeout(t)
  }, [override, clearOverride])

  return {
    mode,
    isAuto: !override,
    autoMode: autoMode(),
    setMode: (m) => setCommuteMode(m),
    clearOverride,
  }
}
