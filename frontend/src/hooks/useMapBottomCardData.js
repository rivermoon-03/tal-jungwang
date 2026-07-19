/**
 * useMapBottomCardData — PC 지도 하단 플로팅 카드(MapBottomCard)에 넣을
 * 데이터를 계산하는 어댑터 훅.
 *
 * PCMapDashboard/BusPanel이 쓰던 정류장·방향·GBIS 실시간 도착 데이터 소스를
 * 그대로 재사용하고(useAppStore.selectedBusStation, useEffectiveDirection,
 * useBusArrivals), 표시용 row 변환은 utils/busArrivalRows.js의 공유 헬퍼를
 * 그대로 쓴다(mistakes.md 2 — 반올림·포맷 인라인 복붙 금지).
 *
 * 한계(TODO): 서울 정류장(gbisStationId=null)은 노선별 useBusTimetable을
 * 개별 훅으로 호출해야 해서(BusPanel의 SeoulRouteRow 참고) 이 훅에서는 아직
 * 지원하지 않는다 — routes가 빈 배열로 내려온다. 셔틀/지하철도 아직 이 카드에
 * 합류하지 않았다(검색 오버레이의 모드 필터가 'bus' 외에는 실데이터가 없는 이유).
 */
import { useMemo } from 'react'
import useAppStore from '../stores/useAppStore'
import useEffectiveDirection from './useEffectiveDirection'
import { useBusArrivals } from './useBus'
import {
  getGbisStationId,
  getAllowedDirections,
  getBusStationDisplay,
} from '../components/dashboard/busStationConfig'
import { groupArrivalsByRoute, buildBusArrivalRow } from '../utils/busArrivalRows'

export default function useMapBottomCardData() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const { direction } = useEffectiveDirection()
  const gbisStationId = getGbisStationId(selectedBusStation)
  const isSeoulStation = gbisStationId === null

  const arrivalsQuery = useBusArrivals(gbisStationId)

  const rows = useMemo(() => {
    if (isSeoulStation) return []
    const arrivals = arrivalsQuery.data?.arrivals ?? []
    const allowedDirs = getAllowedDirections(selectedBusStation)
    const filtered = arrivals.filter((a) => !a.category || allowedDirs.includes(a.category))
    const groups = groupArrivalsByRoute(filtered)
    const now = new Date()
    return groups.map((group) =>
      buildBusArrivalRow(group, { station: selectedBusStation, direction, now })
    )
  }, [isSeoulStation, arrivalsQuery.data, selectedBusStation, direction])

  const routes = useMemo(
    () =>
      rows.map((row) => ({
        id: row.routeNo,
        badge: row.routeNo,
        color: row.routeColor,
        name: row.direction || row.routeNo,
        sub: row.subdirection || undefined,
        etaText:
          typeof row.minutes === 'number'
            ? row.imminent
              ? '곧 도착'
              : `${row.minutes}분`
            : row.etaText,
        tone: row.imminent ? 'imminent' : 'ease',
      })),
    [rows]
  )

  const first = rows[0] ?? null
  const primary = first
    ? {
        routeName: first.routeNo,
        direction: first.direction,
        etaText:
          first.imminent
            ? '곧 도착'
            : typeof first.minutes === 'number'
              ? `${first.minutes}분 뒤 도착`
              : first.etaText,
        nextText: first.minutes2 != null ? `다음 차 ${first.minutes2}분` : null,
        lastText: null,
      }
    : null

  return {
    loading: arrivalsQuery.loading,
    error: arrivalsQuery.error,
    isSeoulStation,
    live: !!first?.isRealtime,
    stationLabel: getBusStationDisplay(selectedBusStation) || selectedBusStation,
    statusLabel: first ? (first.imminent ? '임박' : '여유') : null,
    statusTone: first ? (first.imminent ? 'imminent' : 'ease') : 'ease',
    primary,
    routes,
  }
}
