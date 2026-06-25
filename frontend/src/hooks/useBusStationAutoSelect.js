/**
 * useBusStationAutoSelect
 *
 * 앱 시작 / 방향 변경 시 다음 우선순위로 정류장을 자동 선택:
 *   1. 현재 선택된 정류장이 방향과 맞지 않으면 보정
 *      - GPS coords 있으면 → 허용 정류장 중 최근접
 *      - GPS coords 없으면 → 허용 정류장 중 첫 번째 (기본 폴백)
 *   2. 이미 방향-정류장이 일치하면 아무것도 하지 않음 (사용자 수동 선택 유지)
 *
 * 호출처: Dashboard (모바일). PCStationPicker는 자체 autoMode 로직 보유.
 */
import { useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import useEffectiveDirection from './useEffectiveDirection'
import useUserLocation, { getNearestStation } from './useUserLocation'
import { BUS_STATION_LABELS, getAllowedDirections } from '../components/dashboard/busStationConfig'

export default function useBusStationAutoSelect() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const setBusStation = useAppStore((s) => s.setBusStation)
  const { direction } = useEffectiveDirection()
  const coords = useUserLocation()

  useEffect(() => {
    const allowedForDirection = BUS_STATION_LABELS.filter((s) =>
      getAllowedDirections(s).includes(direction)
    )

    // 현재 정류장이 방향과 일치하면 아무것도 하지 않음
    if (allowedForDirection.includes(selectedBusStation)) return

    // 불일치 → 보정 필요
    let next = null

    if (coords) {
      // GPS 있으면 허용 정류장 중 최근접
      next = getNearestStation(coords[0], coords[1], allowedForDirection)
    }

    // GPS 없거나 최근접 계산 실패 → 첫 번째 허용 정류장으로 폴백
    if (!next) {
      next = allowedForDirection[0] ?? null
    }

    if (next) setBusStation(next)
  }, [direction, selectedBusStation, coords, setBusStation])
}
