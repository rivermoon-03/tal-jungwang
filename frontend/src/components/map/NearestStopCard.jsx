/**
 * NearestStopCard — 지도 확장 화면 하단(dock 위) 고정 카드.
 *
 * 내 위치에서 haversine으로 가장 가까운 정류장(useUserLocation.js의
 * STATION_COORDS/getNearestStationInfo 재사용)을 찾아, 그 정류장을 지나는
 * 노선을 최대 3행 보여준다. 도착 데이터는 MapView가 이미 useBusArrivals로
 * fetch해 둔 값(arrivalsByStation prop)을 그대로 받아쓴다 — 이 카드가 직접
 * 새 API를 호출하지 않는다(CLAUDE.md 3-6, 새 호출 발명 금지).
 *
 * GPS 위치가 없으면 카드 대신 안내 1행을 보여주고, 탭하면 MapView의 기존
 * GPS 소프트 프롬프트 플로우(checkGps)로 연계한다.
 *
 * Props:
 *   userLocation      — { lat, lng } | null
 *   direction         — '등교' | '하교' (useEffectiveDirection)
 *   arrivalsByStation — { [stationName]: { arrivals: [...] } | null }
 *   onSelectStation   — (syntheticStation) => void — 행 탭 시 기존 마커 시트 오픈 핸들러 재사용
 *   onRequestGps      — () => void — GPS 없음 배너 탭 시 호출
 */

import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { getNearestStationInfo, STATION_COORDS } from '../../hooks/useUserLocation'
import { getGbisStationId, getRouteDisplayConfig } from '../dashboard/busStationConfig'
import { formatArrival, formatArrivalFromTime } from '../../utils/arrivalTime'
import { metersToWalkMinutes } from '../../utils/walkEstimate'
import { getKstHourMinuteLabel } from '../../utils/timeOfDay'
import DataBadge from '../ui/DataBadge'
import RouteBadge from '../ui/RouteBadge'

// arrivalsByStation이 실제로 채워주는 정류장만 후보로 삼는다 — GBIS 실시간 데이터가
// 없는 정류장(시화터미널/서울)이 최근접으로 뽑히면 행이 늘 비어 보이므로 제외.
const SUPPORTED_STATION_NAMES = ['한국공학대', '이마트', '시흥시청']

const MAX_ROWS = 3

function buildRows(arrivalsData, direction) {
  const arrivals = arrivalsData?.arrivals ?? []
  const seen = new Set()
  const rows = []
  for (const a of arrivals) {
    if (direction && a.category !== direction) continue
    if (seen.has(a.route_no)) continue
    seen.add(a.route_no)

    const isRealtime = a.arrival_type !== 'timetable'
    const cfg = getRouteDisplayConfig(a.route_no)
    let minutesLabel
    if (isRealtime) {
      minutesLabel = formatArrival(a.arrive_in_seconds) ?? '정보 없음'
    } else if (a.is_tomorrow) {
      minutesLabel = `내일 ${a.depart_at}`
    } else {
      minutesLabel = formatArrivalFromTime(a.depart_at) ?? '—'
    }

    rows.push({
      routeNo: a.route_no,
      destination: a.destination ?? cfg?.direction ?? '',
      isRealtime,
      minutesLabel,
    })
    if (rows.length >= MAX_ROWS) break
  }
  return rows
}

export default function NearestStopCard({
  userLocation,
  direction,
  arrivalsByStation = {},
  onSelectStation,
  onRequestGps,
}) {
  const nearest = useMemo(() => {
    if (userLocation?.lat == null || userLocation?.lng == null) return null
    return getNearestStationInfo(userLocation.lat, userLocation.lng, SUPPORTED_STATION_NAMES)
  }, [userLocation])

  if (!userLocation) {
    return (
      <button
        type="button"
        onClick={onRequestGps}
        aria-label="내 위치 켜기"
        className="absolute left-3 right-3 z-[55] flex items-center gap-2 min-h-[44px]
                   bg-surface dark:bg-surface border border-line dark:border-line
                   rounded-card shadow-sh-pop px-3.5 py-2.5
                   text-caption text-mute dark:text-mute active:scale-[0.99]
                   transition-transform duration-press ease-spring"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <MapPin size={16} className="text-accent flex-shrink-0" aria-hidden="true" />
        <span className="truncate">내 위치를 켜면 가까운 정류장을 보여드려요</span>
      </button>
    )
  }

  if (!nearest) return null

  const walkMinutes = metersToWalkMinutes(nearest.distanceM)
  const rows = buildRows(arrivalsByStation[nearest.name], direction)
  const coord = STATION_COORDS[nearest.name]

  function handleTap() {
    onSelectStation?.({
      id: `nearest_${nearest.name}`,
      name: nearest.name,
      type: 'bus',
      lat: coord?.[0] ?? null,
      lng: coord?.[1] ?? null,
      primaryStopGbisId: getGbisStationId(nearest.name),
      walkMinutes,
    })
  }

  return (
    <div
      className="absolute left-3 right-3 z-[55] bg-surface dark:bg-surface
                 rounded-card shadow-sh-pop border border-line dark:border-line overflow-hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <header className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-1.5">
        <button
          type="button"
          onClick={handleTap}
          className="flex items-center gap-1.5 min-w-0 text-left min-h-[28px]"
        >
          <span className="text-body font-bold text-ink dark:text-ink truncate">{nearest.name}</span>
          <span className="text-caption text-mute dark:text-mute whitespace-nowrap">
            · 도보 {walkMinutes}분
          </span>
        </button>
        <span className="text-caption text-mute dark:text-mute whitespace-nowrap flex-shrink-0">
          {getKstHourMinuteLabel()} · {direction}
        </span>
      </header>

      <ul className="px-1.5 pb-1.5">
        {rows.length === 0 && (
          <li className="px-2 py-2.5 text-caption text-mute dark:text-mute">
            도착 정보를 준비 중이에요
          </li>
        )}
        {rows.map((row) => (
          <li key={row.routeNo}>
            <button
              type="button"
              onClick={handleTap}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-button min-h-[44px]
                         active:bg-surface-2 dark:active:bg-surface-2-dark transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <RouteBadge route={row.routeNo} />
              <span className="flex-1 min-w-0 text-caption text-ink-2 dark:text-ink-2 truncate text-left">
                {row.destination}
              </span>
              <DataBadge state={row.isRealtime ? 'live' : 'timetable'} compact />
              <span className="text-label font-bold text-ink dark:text-ink tabular-nums whitespace-nowrap">
                {row.minutesLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
