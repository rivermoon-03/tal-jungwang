import { useMemo } from 'react'
import useAppStore from '../stores/useAppStore'
import { useBusRoutes } from './useBus'
import { parseFavCode } from '../utils/favCode'
import { allFavoriteCodes } from '../utils/favKey'

/**
 * 즐겨찾기 목록을 화면이 바로 쓸 수 있는 항목 배열로 만든다.
 *
 * 저장 위치가 두 갈래다. 시간표와 노선 상세는 신규 스키마를 favorites.keys 에,
 * 나머지는 레거시 favCode 를 favorites.routes 에 쓴다. 독 팝오버와 PC 사이드바는
 * routes 만 읽어서, 시간표에서 누른 별이 두 화면에서 조용히 사라졌다.
 *
 * 버스 신규 키는 id 자리에 route_id(숫자) 가 들어간다. 그대로 그리면 "3 (하교)"
 * 처럼 내부 id 가 화면에 찍히므로 노선 목록으로 노선번호를 되찾는다.
 * 노선 목록은 10분 캐시 GET 이라 두 화면이 같이 써도 요청이 늘지 않는다.
 */
export function useFavoriteItems({ limit } = {}) {
  const favorites = useAppStore((s) => s.favorites)
  const { data: routes } = useBusRoutes()

  const codes = useMemo(() => allFavoriteCodes(favorites), [favorites])

  const routeNumberById = useMemo(() => {
    const map = new Map()
    for (const r of routes ?? []) {
      if (r?.route_id != null && r?.route_number) map.set(String(r.route_id), r.route_number)
    }
    return map
  }, [routes])

  const items = useMemo(() => {
    const parsed = []
    for (const code of codes) {
      const item = parseFavCode(code)
      if (!item) continue
      if (item.type === 'bus' && item.routeId != null) {
        const routeNumber = routeNumberById.get(String(item.routeId))
        // 노선 목록이 아직 안 왔으면 id 대신 아무것도 지어내지 않고 그대로 둔다.
        if (routeNumber) {
          parsed.push({
            ...item,
            routeCode: routeNumber,
            title: item.category ? `${routeNumber} (${item.category})` : routeNumber,
          })
          continue
        }
      }
      parsed.push(item)
    }
    return limit ? parsed.slice(0, limit) : parsed
  }, [codes, routeNumberById, limit])

  return { items, totalCount: codes.length }
}
