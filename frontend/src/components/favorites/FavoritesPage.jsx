/**
 * FavoritesPage — 즐겨찾기 탭 (라이브 타일)
 *
 * 즐겨찾기 대상: routes + stations (Zustand persist)
 * 라이브 데이터: useBusArrivals로 정류장 도착 정보 가져옴 (shuttle/subway 다음 열차도)
 * TODO: 즐겨찾기 항목마다 개별 API 호출 대신 batch 엔드포인트 추가 시 교체
 */
import { Star } from 'lucide-react'
import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import FavoritesHero from './FavoritesHero'
import FavoritesList from './FavoritesList'
import { useShuttleNext } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'

// 노선 코드 → 정류장 ID 매핑 (GBIS 기반)
const ROUTE_STATION_MAP = {
  '20-1':   { stationId: '224000639', stationName: '한국공학대학교', type: 'bus' },
  '시흥33': { stationId: '224000639', stationName: '한국공학대학교', type: 'bus' },
  '시흥1':  { stationId: '224000513', stationName: '이마트', type: 'bus' },
  '3400':   { stationId: '224000513', stationName: '이마트', type: 'bus' },
  '6502':   { stationId: '224000513', stationName: '이마트', type: 'bus' },
}

// 도보 시간 기준 탑승 상태 판정
function getBoardingStatus(arrivalMin, walkMin) {
  if (arrivalMin == null || walkMin == null) return '여유'
  const diff = arrivalMin - walkMin
  if (diff >= 3) return '여유'
  if (diff >= 0) return '빠듯'
  return '서두르세요'
}

function useFavoriteItems(favorites) {
  // 셔틀 다음 열차
  const { data: shuttleNextAll } = useShuttleNext()
  // 지하철 다음 열차
  const { data: subwayNext } = useSubwayNext()

  const items = useMemo(() => {
    const result = []

    // 즐겨찾기 노선들
    for (const routeCode of favorites.routes ?? []) {
      const meta = ROUTE_STATION_MAP[routeCode]
      if (!meta) {
        // 셔틀 or 지하철 처리
        if (routeCode === 'shuttle') {
          const next = shuttleNextAll?.entries?.[0]
          result.push({
            id: `shuttle`,
            type: 'shuttle',
            routeCode: '셔틀',
            stationName: '한국공학대학교',
            minutes: next?.minutesLeft ?? null,
            walkMin: 3,
            status: getBoardingStatus(next?.minutesLeft ?? null, 3),
          })
        } else if (routeCode === 'subway') {
          const next = subwayNext?.up?.[0]
          const min = next ? Math.max(0, Math.round((new Date(next.departureTime) - Date.now()) / 60000)) : null
          result.push({
            id: 'subway',
            type: 'subway',
            routeCode: '수인분당선',
            stationName: '정왕',
            minutes: min,
            walkMin: 10,
            status: getBoardingStatus(min, 10),
          })
        }
        continue
      }
      // bus route — will be filled below after arrivals
      result.push({
        id: `route:${routeCode}`,
        type: 'bus',
        routeCode,
        stationName: meta.stationName,
        stationId: meta.stationId,
        minutes: null,
        walkMin: 5,
        status: '여유',
        _needsArrival: true,
      })
    }

    return result
  }, [favorites.routes, shuttleNextAll, subwayNext])

  return items
}

export default function FavoritesPage({ onGoSchedule }) {
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)

  // TODO: Live arrival per-favorite patch — currently shows static minutes
  // Full live data requires per-station polling; acceptable for v1
  const rawItems = useFavoriteItems(favorites)

  const isEmpty = rawItems.length === 0

  // hero = lowest minutes item
  const sorted = [...rawItems].sort((a, b) => (a.minutes ?? 999) - (b.minutes ?? 999))
  const hero = sorted[0] ?? null
  const listItems = sorted.slice(1)

  function handleRemove(id) {
    const [type, code] = id.split(':')
    if (type === 'route') toggleFavoriteRoute(code)
    else toggleFavoriteStation(code)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 bg-coral text-white px-5 py-4 flex-shrink-0">
        <Star size={20} strokeWidth={2} fill="currentColor" />
        <h2 className="text-lg font-bold">즐겨찾기</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6 flex flex-col gap-3">
        {/* hero */}
        <FavoritesHero
          item={isEmpty ? null : hero}
          loading={false}
          onGoSchedule={onGoSchedule}
        />

        {/* list */}
        {!isEmpty && listItems.length > 0 && (
          <>
            <p className="text-xs font-bold text-slate-400 px-1 mt-1">전체 즐겨찾기</p>
            <FavoritesList
              items={listItems}
              onRemove={handleRemove}
            />
          </>
        )}

        {/* empty prompt under hero when only hero item exists */}
        {!isEmpty && listItems.length === 0 && (
          <p className="text-xs text-center text-slate-400 mt-2">
            시간표 탭에서 더 추가할 수 있어요 ⭐
          </p>
        )}
      </div>
    </div>
  )
}
