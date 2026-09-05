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
 * GPS 소프트 프롬프트 플로우(checkGps)로 연계한다. 그 프롬프트 카드가 떠 있는
 * 동안(hidden)은 안내 행을 그리지 않는다 — 예전엔 "위치 켜기"와 "허용하기"
 * 두 CTA 가 위아래로 동시에 보였다.
 *
 * 접힘/펼침: 3행을 다 펼친 카드가 뷰포트의 27~36%를 차지해(실측) 지도가 가운데
 * 띠만 남았다. 기본은 1행(정류장명 + 첫 도착)으로 접혀 있고, 손잡이나 헤더를
 * 탭하면 3행이 된다. 상태는 컴포넌트가 살아 있는 동안 유지된다.
 *
 * 위치 지정은 이 컴포넌트가 하지 않는다(w-full 블록으로만 렌더) — MapView가
 * 우하단 "내 위치" FAB과 함께 flex-column에 넣어 absolute로 띄운다(§M-3).
 *
 * Props:
 *   userLocation      — { lat, lng } | null
 *   direction         — '등교' | '하교' (useEffectiveDirection)
 *   arrivalsByStation — { [stationName]: { arrivals: [...] } | null }
 *   onSelectStation   — (syntheticStation) => void — 행 탭 시 기존 마커 시트 오픈 핸들러 재사용
 *   onRequestGps      — () => void — GPS 없음 배너 탭 시 호출
 *   summaryText       — string | null — 헤더 아래 보조 줄(정왕역 ↔ 학교 구간 요약)
 *   hidden            — true면 아무것도 그리지 않는다(GPS 프롬프트가 떠 있는 동안)
 *   defaultExpanded   — 초기 펼침 상태(기본 false)
 */

import { useMemo, useState } from 'react'
import { ChevronUp, MapPin } from 'lucide-react'
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
const COLLAPSED_ROWS = 1

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
      minutesLabel = formatArrivalFromTime(a.depart_at) ?? '·'
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
  summaryText = null,
  hidden = false,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const nearest = useMemo(() => {
    if (userLocation?.lat == null || userLocation?.lng == null) return null
    return getNearestStationInfo(userLocation.lat, userLocation.lng, SUPPORTED_STATION_NAMES)
  }, [userLocation])

  if (hidden) return null

  if (!userLocation) {
    return (
      <button
        type="button"
        onClick={onRequestGps}
        aria-label="내 위치 켜기"
        className="w-full flex items-center gap-2 min-h-[44px]
                   bg-surface dark:bg-surface border border-line dark:border-line
                   rounded-card shadow-sh-pop px-3.5 py-2.5
                   text-caption text-mute dark:text-mute active:scale-[0.99]
                   transition-transform duration-press ease-spring"
      >
        <MapPin size={16} className="text-accent flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0 truncate text-left">내 위치를 켜면 가까운 정류장을 보여드려요</span>
        <span className="flex-shrink-0 rounded-pill bg-accent px-2.5 py-1 text-caption font-bold text-white">
          위치 켜기
        </span>
      </button>
    )
  }

  if (!nearest) return null

  const walkMinutes = metersToWalkMinutes(nearest.distanceM)
  const rows = buildRows(arrivalsByStation[nearest.name], direction)
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_ROWS)
  const hiddenCount = rows.length - visibleRows.length
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
      data-expanded={expanded ? 'true' : 'false'}
      className="w-full bg-surface dark:bg-surface
                 rounded-card shadow-sh-pop border border-line dark:border-line overflow-hidden"
    >
      {/* 손잡이 — 탭하면 접힘/펼침. 시각 높이는 작지만 히트 영역은 28px. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? '가까운 정류장 카드 접기' : '가까운 정류장 카드 펼치기'}
        className="w-full flex items-center justify-center min-h-[22px] pt-2 pb-0.5"
      >
        <span aria-hidden="true" className="h-1 w-9 rounded-pill bg-line-strong" />
      </button>

      <header className="flex items-center justify-between gap-2 px-3.5 pt-0.5 pb-1.5">
        <button
          type="button"
          onClick={handleTap}
          className="flex flex-col items-start min-w-0 text-left min-h-[28px]"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-body font-bold text-ink dark:text-ink truncate">{nearest.name}</span>
            <span className="text-caption text-mute dark:text-mute whitespace-nowrap">
              · 도보 {walkMinutes}분
            </span>
          </span>
          {summaryText && (
            <span className="text-meta text-mute dark:text-mute truncate">{summaryText}</span>
          )}
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
        {visibleRows.map((row) => (
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
        {!expanded && hiddenCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1 min-h-[32px]
                         text-caption font-semibold text-accent-ink dark:text-accent-ink"
            >
              노선 {hiddenCount}개 더 보기
              <ChevronUp size={14} aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
