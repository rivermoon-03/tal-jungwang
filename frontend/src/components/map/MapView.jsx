import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Navigation, School, Search, Map as MapIcon } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import UserLocationMarker from './UserLocationMarker'
import DriveRoutePolyline from './DriveRoutePolyline'
import WalkRoutePolyline from './WalkRoutePolyline'
import WalkRouteCard from './WalkRouteCard'
import NearestStopCard from './NearestStopCard'
import { apiFetch } from '../../hooks/useApi'
import RestaurantOverlay from './RestaurantOverlay'
import TrafficRoadOverlay from './TrafficRoadOverlay'
import ZoomAwareOverlayManager from './ZoomAwareOverlayManager'
import MarkerSheet from './MarkerSheet'
import GpsSoftPrompt, { useGpsSoftPrompt } from './GpsSoftPrompt'
import { useShuttleNext, useShuttleSchedule, DEFAULT_CENTER } from '../../hooks/useShuttle'
import { useSubwayNext, useSubwayTimetable } from '../../hooks/useSubway'
import { useBusArrivals, useBusStations, useBusTimetableByRoute } from '../../hooks/useBus'
import { useMapMarkers } from '../../hooks/useMapMarkers'
import useUserLocation from '../../hooks/useUserLocation'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { getFirstBusLabel } from '../../utils/arrivalTime'
import { getRouteDisplayConfig } from '../dashboard/busStationConfig'

function getPrimaryStopId(marker) {
  if (!marker) return null
  if (marker.type === 'bus') return marker.primaryStopGbisId ?? null
  const first = marker.routes?.[0]
  if (!first) return null
  return first.outbound_stop_gbis_id ?? first.outbound_stop_id ?? null
}

// 본캠 정문 좌표는 hooks/useShuttle.js에서 export(DEFAULT_CENTER) — 컴포넌트 파일에
// 상수를 두면 react-refresh/only-export-components(Fast Refresh) 규칙을 어겨서
// 훅 파일로 옮겼다. useEffectiveDirection(F1)도 같은 상수를 그 훅에서 가져다 쓴다.
const SDK_SCRIPT_ID = 'kakao-map-sdk'

// 지도 마커는 분 단위 표시라 도착 훅을 60초 tick으로 받는다 (카드의 1초 tick과 분리).
const MARKER_TICK = { tickMs: 60_000 }


// mapExpanded=false(기본값)일 땐 기존 우하단 FAB 배치를 그대로 쓴다(PCMainShell 등
// mapExpanded 개념이 없는 호출부와 100% 호환). MainShell이 지도를 전체화면으로
// 펼칠 때만 mapExpanded=true를 넘겨 상단 검색바 · 우측 상단 컨트롤 스택 ·
// 최근접 정류장 카드(M-1)로 전환한다.
export default function MapView({ onMarkerClick, selectedId, mapExpanded = false, onClose }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [sdkReady, setSdkReady] = useState(() => Boolean(window.kakao?.maps?.LatLng))
  const [mapInstance, setMapInstance] = useState(null)
  const kakaoKey = import.meta.env.VITE_KAKAO_JS_APP_KEY
  const userLocation        = useAppStore((s) => s.userLocation)
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const mapPanTarget        = useAppStore((s) => s.mapPanTarget)
  const setMapPanTarget     = useAppStore((s) => s.setMapPanTarget)
  const activeTab           = useAppStore((s) => s.activeTab)
  const selectedMode        = useAppStore((s) => s.selectedMode)
  const setSearchOpen       = useAppStore((s) => s.setSearchOpen)
  const { direction: effectiveDirection } = useEffectiveDirection()

  // 지도 확장 중에만 GPS를 요청한다(mistakes.md §3 — 숨김 상태에서 GPS가 백그라운드로
  // 도는 것 방지). 진입 시 권한이 있으면 좌표가 도착하는 대로 아래 effect가 1회 센터링한다.
  const gpsCoords = useUserLocation(mapExpanded)
  const centeredOnExpandRef = useRef(false)

  // 실시간 데이터 훅
  // 지도 마커는 분 단위 표시라 60초 tick으로 충분 — 매초 마커 재계산을 피한다.
  const { data: shuttleToSchoolData }   = useShuttleNext(0, MARKER_TICK) // 등교: 정왕역 → 학교
  const { data: shuttleFromSchoolData } = useShuttleNext(1, MARKER_TICK) // 하교: 학교 → 정왕역
  const { data: shuttleToCampus2Data }   = useShuttleNext(2, MARKER_TICK) // 2캠 등교: 본캠 → 2캠
  const { data: shuttleFromCampus2Data } = useShuttleNext(3, MARKER_TICK) // 2캠 하교: 2캠 → 본캠
  const { data: shuttleToSchoolSched }  = useShuttleSchedule(0)
  const { data: shuttleFromSchoolSched } = useShuttleSchedule(1)
  const { data: shuttleToCampus2Sched }  = useShuttleSchedule(2)
  const { data: shuttleFromCampus2Sched } = useShuttleSchedule(3)
  const { data: subwayNextData }        = useSubwayNext(MARKER_TICK)
  const { data: seohaeTimetable }       = useSubwayTimetable()
  const { data: busArrivalsData }       = useBusArrivals(224000639, MARKER_TICK)
  const { data: busArrivalsSiheung }    = useBusArrivals(224000586, MARKER_TICK)
  const { data: busArrivalsEmart }      = useBusArrivals(224000513, MARKER_TICK)
  const { data: stationsData }          = useBusStations()
  const { data: markersData }           = useMapMarkers()

  // 정류장 이름 → stop_id 해석 (순수 지명으로 정규화된 name 사용)
  const stopIds = useMemo(() => {
    const stations = stationsData ?? []
    const byName = (name) => stations.find((s) => s.name === name)?.station_id ?? null
    return {
      sihwa:   byName('시화'),
      emart:   byName('이마트'),
      sadang:  byName('사당역'),
      gangnam: byName('강남역'),
      seoksu:  byName('석수역'),
      guro:    byName('구로디지털단지역'),
    }
  }, [stationsData])

  // requireStopId: true — stopId가 로드되기 전에 stop 없이 잘못된 시간표를 가져오는 것을 방지
  const { data: timetable3400Out } = useBusTimetableByRoute('3400', { stopId: stopIds.sihwa,   requireStopId: true })
  const { data: timetable3400In  } = useBusTimetableByRoute('3400', { stopId: stopIds.gangnam, requireStopId: true })
  const { data: timetable6502Out } = useBusTimetableByRoute('6502', { stopId: stopIds.emart,   requireStopId: true })
  const { data: timetable6502In  } = useBusTimetableByRoute('6502', { stopId: stopIds.sadang,  requireStopId: true })
  const { data: timetable3401Out } = useBusTimetableByRoute('3401', { stopId: stopIds.emart,   requireStopId: true })
  const { data: timetable3401In  } = useBusTimetableByRoute('3401', { stopId: stopIds.seoksu,  requireStopId: true })
  const { data: timetable5602Out } = useBusTimetableByRoute('5602', { stopId: stopIds.emart,   requireStopId: true })
  const { data: timetable5602In  } = useBusTimetableByRoute('5602', { stopId: stopIds.guro,    requireStopId: true })

  // liveMinutes 계산
  const shuttleToSchoolMins = useMemo(() => {
    const sec = shuttleToSchoolData?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.ceil(sec / 60))
  }, [shuttleToSchoolData])

  const shuttleFromSchoolMins = useMemo(() => {
    const sec = shuttleFromSchoolData?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.ceil(sec / 60))
  }, [shuttleFromSchoolData])

  const shuttleToCampus2Mins = useMemo(() => {
    const sec = shuttleToCampus2Data?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.ceil(sec / 60))
  }, [shuttleToCampus2Data])

  const shuttleFromCampus2Mins = useMemo(() => {
    const sec = shuttleFromCampus2Data?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.ceil(sec / 60))
  }, [shuttleFromCampus2Data])

  const subwayLiveMinutes = useMemo(() => {
    const sec = subwayNextData?.up?.arrive_in_seconds ?? subwayNextData?.down?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.ceil(sec / 60))
  }, [subwayNextData])

  const busLiveMinutes = useMemo(() => {
    const arrivals = busArrivalsData?.arrivals ?? []
    if (!arrivals.length) return null
    const secs = arrivals
      .filter((a) => a.arrival_type === 'realtime')
      .map((a) => a.arrive_in_seconds)
      .filter((s) => s != null)
    if (!secs.length) return null
    return Math.max(0, Math.ceil(Math.min(...secs) / 60))
  }, [busArrivalsData])

  const minsUntilNextTimetable = (timetable) => {
    const times = timetable?.times ?? []
    if (!times.length) return null
    const now = new Date()
    for (const t of times) {
      const [hh, mm] = String(t).split(':').map(Number)
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue
      const candidate = new Date(now)
      candidate.setHours(hh, mm, 0, 0)
      const diffMs = candidate - now
      if (diffMs < 0) continue
      const diff = Math.ceil(diffMs / 60000)
      // 12시간 이상 뒤는 건너뜀 (자정 이후 전날 막차 오인 방지)
      if (diff <= 12 * 60) return diff
    }
    return null
  }

  const bus3400OutMinutes = useMemo(() => minsUntilNextTimetable(timetable3400Out), [timetable3400Out])
  const bus3400InMinutes  = useMemo(() => minsUntilNextTimetable(timetable3400In),  [timetable3400In])
  const bus6502OutMinutes = useMemo(() => minsUntilNextTimetable(timetable6502Out), [timetable6502Out])
  const bus6502InMinutes  = useMemo(() => minsUntilNextTimetable(timetable6502In),  [timetable6502In])
  const bus3401OutMinutes = useMemo(() => minsUntilNextTimetable(timetable3401Out), [timetable3401Out])
  const bus3401InMinutes  = useMemo(() => minsUntilNextTimetable(timetable3401In),  [timetable3401In])
  const bus5602OutMinutes = useMemo(() => minsUntilNextTimetable(timetable5602Out), [timetable5602Out])
  const bus5602InMinutes  = useMemo(() => minsUntilNextTimetable(timetable5602In),  [timetable5602In])

  const nextMinFromTrains = (trains) => {
    if (!trains?.length) return null
    const now = new Date()
    const next = trains.find((t) => {
      const [hh, mm] = String(t.depart_at).split(':').map(Number)
      const candidate = new Date(now)
      candidate.setHours(hh, mm, 0, 0)
      const diffMs = candidate - now
      // 자정 이후 전날 막차 오인 방지: 0 < diff <= 12h
      return diffMs > 0 && diffMs <= 12 * 60 * 60 * 1000
    })
    if (!next) return null
    const [hh, mm] = String(next.depart_at).split(':').map(Number)
    const candidate = new Date(now)
    candidate.setHours(hh, mm, 0, 0)
    return Math.max(0, Math.ceil((candidate - now) / 60000))
  }
  const chojiMinutes = useMemo(() => {
    const up = nextMinFromTrains(seohaeTimetable?.choji_up)
    const dn = nextMinFromTrains(seohaeTimetable?.choji_dn)
    const vals = [up, dn].filter((v) => v != null)
    return vals.length ? Math.min(...vals) : null
  }, [seohaeTimetable])
  const siheungUpMinutes = useMemo(() => {
    const liveSec = subwayNextData?.siheung_up?.arrive_in_seconds
    if (liveSec != null) return Math.max(0, Math.ceil(liveSec / 60))
    return nextMinFromTrains(seohaeTimetable?.siheung_up)
  }, [subwayNextData, seohaeTimetable])
  const siheungDnMinutes = useMemo(() => {
    const liveSec = subwayNextData?.siheung_dn?.arrive_in_seconds
    if (liveSec != null) return Math.max(0, Math.ceil(liveSec / 60))
    return nextMinFromTrains(seohaeTimetable?.siheung_dn)
  }, [subwayNextData, seohaeTimetable])
  const siheungMinutes = useMemo(() => {
    const vals = [siheungUpMinutes, siheungDnMinutes].filter((v) => v != null)
    return vals.length ? Math.min(...vals) : null
  }, [siheungUpMinutes, siheungDnMinutes])
  // 시흥시청역에서 가장 빨리 오는 등교 버스 (실시간)
  const siheungEarliestBus = useMemo(() => {
    const arrivals = busArrivalsSiheung?.arrivals ?? []
    let best = null
    for (const a of arrivals) {
      if (a.category !== '등교') continue
      if (a.arrival_type !== 'realtime') continue
      if (a.arrive_in_seconds == null) continue
      if (!best || a.arrive_in_seconds < best.arrive_in_seconds) best = a
    }
    if (!best) return null
    return {
      routeNo: best.route_no,
      minutes: Math.max(0, Math.ceil(best.arrive_in_seconds / 60)),
    }
  }, [busArrivalsSiheung])

  // 노선 번호 + 방향(out/in) → 계산된 분 lookup
  const liveMinByRouteDir = useMemo(() => ({
    '3400-out': bus3400OutMinutes, '3400-in': bus3400InMinutes,
    '6502-out': bus6502OutMinutes, '6502-in': bus6502InMinutes,
    '3401-out': bus3401OutMinutes, '3401-in': bus3401InMinutes,
    '5602-out': bus5602OutMinutes, '5602-in': bus5602InMinutes,
  }), [bus3400OutMinutes, bus3400InMinutes, bus6502OutMinutes, bus6502InMinutes, bus3401OutMinutes, bus3401InMinutes, bus5602OutMinutes, bus5602InMinutes])

  // ── STATIC 레이어 (#7a): markersData에만 의존 ──────────────────
  // 위치·정적 메타·라우팅·mirror map·isLocalHub·relatedMarkers 등 분 단위로 변하지 않는 구조.
  // markersData는 앱 기동 시 1회 fetch(SW SWR)라 사실상 불변 → 이 참조가 안정화되어
  // 매 tick 라이브 갱신에서 이 무거운 계산(map·mirror 탐색)이 재실행되지 않는다.
  const staticStationData = useMemo(() => {
    const list = markersData?.markers ?? []

    // (route_number, outbound_stop_id) → marker key (bus_seoul 간 mirror 탐색용)
    const routeOutboundToKey = new Map()
    // key → raw marker (mirror 이름 조회를 O(1)로; 기존 list.find O(n) 이중 루프 제거)
    const markerByKey = new Map()
    for (const m of list) {
      markerByKey.set(m.key, m)
      if (m.type !== 'bus_seoul') continue
      for (const r of m.routes ?? []) {
        if (r.outbound_stop_id != null)
          routeOutboundToKey.set(`${r.route_number}:${r.outbound_stop_id}`, m.key)
      }
    }

    return list.map((m) => {
      const ui = m.ui_meta ?? {}
      const base = {
        id: m.key,
        name: m.name,
        type: m.type,
        lat: m.lat,
        lng: m.lng,
        routeCode: ui.routeCode,
        routeColor: ui.routeColor,
        badgeText: ui.badgeText,
        showLive: ui.showLive ?? false,
        liveInaccurate: ui.liveInaccurate,
        chipVariant: ui.chipVariant,
        extraPillText: ui.extraPillText,
        tabId: ui.tabId,
        iconType: ui.iconType,
        subLabelSep: ui.subLabelSep,
      }

      if (m.type === 'shuttle') {
        return {
          ...base,
          iconType: ui.iconType ?? 'bus',
          direction: ui.direction,
          showLive: ui.showLive ?? false,
        }
      }
      if (m.type === 'subway') {
        return { ...base, chipVariant: ui.chipVariant ?? 'subwayMulti' }
      }
      if (m.type === 'bus') {
        return {
          ...base,
          iconType: ui.iconType ?? 'bus',
          subLabelSep: ui.subLabelSep ?? '|',
          primaryStopGbisId: ui.primaryStopGbisId ?? null,
          routes: m.routes ?? [],
        }
      }
      if (m.type === 'seohae') {
        // ui_meta.tabId가 DB에 없으면 마커 key로 추론
        const tabId = ui.tabId ?? (m.key.includes('choji') ? 'choji' : 'siheung')
        if (tabId === 'siheung') {
          return { ...base, tabId, routes: m.routes ?? [], chipVariant: 'seohaeSiheung' }
        }
        return { ...base, tabId, routes: m.routes ?? [] }
      }
      if (m.type === 'bus_seoul') {
        const primary = m.routes?.[0] ?? null
        const pUi = primary?.ui_meta ?? {}
        const routeNums = (m.routes ?? []).map((r) => r.route_number)
        const isMultiRoute = routeNums.length > 1

        // 로컬 허브 (bus_hub_jw_*): outbound only, 서울 마커 링크 버튼 제공
        const isLocalHub = m.key.startsWith('bus_hub_jw_')

        // 미러 마커 탐색: 각 route의 inbound_stop_id → outbound_stop이 같은 상대 마커
        const seenRelated = new Set()
        const relatedMarkers = []
        for (const r of m.routes ?? []) {
          if (r.inbound_stop_id == null) continue
          const mirrorKey = routeOutboundToKey.get(`${r.route_number}:${r.inbound_stop_id}`)
          if (mirrorKey && mirrorKey !== m.key && !seenRelated.has(mirrorKey)) {
            const raw = markerByKey.get(mirrorKey)
            if (raw) { seenRelated.add(mirrorKey); relatedMarkers.push({ key: mirrorKey, name: raw.name }) }
          }
        }

        return {
          ...base,
          routeCode: primary?.route_number ?? base.routeCode,
          routeColor: primary?.route_color ?? base.routeColor,
          badgeText:  primary?.badge_text ?? base.badgeText,
          // 다중 노선 허브 → 시간 대신 "6502 외 N대" 형식 표시
          subLabel: isMultiRoute ? `${routeNums[0]} 외 ${routeNums.length - 1}대` : null,
          showLive: !isMultiRoute,
          isMultiRoute,
          // 방향 토글은 허브 수준 — 첫 노선의 spine 사용
          spineLeft: pUi.spineLeft,
          spineRight: pUi.spineRight,
          outboundActiveSide: pUi.outboundActiveSide,
          inboundActiveSide:  pUi.inboundActiveSide,
          outboundSegment: pUi.outboundSegment,
          inboundSegment:  pUi.inboundSegment,
          // 단일 노선 호환 필드 (sheet에서 사용)
          route: primary?.route_number,
          outboundStopId: primary?.outbound_stop_id,
          inboundStopId:  primary?.inbound_stop_id,
          outboundDirLabel: pUi.outboundDirLabel,
          inboundDirLabel:  pUi.inboundDirLabel,
          // 다중 노선 허브용 — sheet가 iterate
          routes: m.routes ?? [],
          isLocalHub,
          relatedMarkers,
        }
      }
      return base
    })
  }, [markersData])

  // ── LIVE 레이어 (#7a): 분 단위 변동 값만 정적 구조에 주입 ───────
  // staticStationData(안정 참조)를 받아 라이브 필드만 덧씌운다. 60초 tick마다 새 배열이지만
  // 무거운 구조 계산은 위 useMemo가 캐시하므로 여기서는 얕은 병합만 일어난다.
  const managedStations = useMemo(() => {
    const liveMinsByShuttleDir = {
      0: shuttleToSchoolMins,
      1: shuttleFromSchoolMins,
      2: shuttleToCampus2Mins,
      3: shuttleFromCampus2Mins,
    }
    return staticStationData.map((s) => {
      if (s.type === 'shuttle') {
        const isReturnTrip = s.direction === 0 && !!(shuttleToSchoolData?.note?.includes('회차편'))
        // note 예: "회차편 · 학교 21:20 출발" → HH:MM 추출
        const noteMatch = isReturnTrip ? shuttleToSchoolData?.note?.match(/(\d{2}:\d{2})/) : null
        const departTime = noteMatch ? noteMatch[1] : null
        return {
          ...s,
          liveMinutes: isReturnTrip ? null : (liveMinsByShuttleDir[s.direction] ?? null),
          showLive: isReturnTrip ? false : s.showLive,
          subLabel: isReturnTrip && departTime ? `하교 ${departTime} 출발` : null,
        }
      }
      if (s.type === 'subway') {
        return { ...s, liveMinutes: subwayLiveMinutes, subwayData: subwayNextData }
      }
      if (s.type === 'bus') {
        const busArrivalLabel = busLiveMinutes != null ? `정왕역 ${busLiveMinutes}분` : '정왕역'
        return { ...s, subLabel: s.subLabel ?? busArrivalLabel, liveMinutes: busLiveMinutes }
      }
      if (s.type === 'seohae') {
        const mins = s.tabId === 'choji' ? chojiMinutes : siheungMinutes
        if (s.tabId === 'siheung') {
          return {
            ...s,
            liveMinutes: mins,
            upMinutes:   siheungUpMinutes,
            dnMinutes:   siheungDnMinutes,
            earliestBus: siheungEarliestBus,
          }
        }
        return { ...s, liveMinutes: mins }
      }
      if (s.type === 'bus_seoul') {
        if (s.isMultiRoute) return s
        const outMins = (s.routes ?? [])
          .map((r) => liveMinByRouteDir[`${r.route_number}-out`])
          .filter((v) => v != null)
        return { ...s, liveMinutes: outMins.length ? Math.min(...outMins) : null }
      }
      return s
    })
  }, [staticStationData, shuttleToSchoolData, shuttleToSchoolMins, shuttleFromSchoolMins, shuttleToCampus2Mins, shuttleFromCampus2Mins, subwayLiveMinutes, subwayNextData, busLiveMinutes, chojiMinutes, siheungMinutes, siheungUpMinutes, siheungDnMinutes, siheungEarliestBus, liveMinByRouteDir])

  // selectedMode에 따라 학교방향 chip + G(extraPillText) chip 노출 필터링
  // - taxi: 관리형 정류장 마커(학교방향 chip 포함) 전체 숨김
  // - bus : 전부 노출 (현상 유지)
  // - subway / shuttle : 마커는 노출하되 G (extraPillText) pill만 숨김
  const visibleStations = useMemo(() => {
    if (selectedMode === 'taxi') return []
    if (selectedMode === 'bus') return managedStations
    // subway / shuttle: extraPillText 제거
    return managedStations.map((s) =>
      s.extraPillText ? { ...s, extraPillText: null } : s
    )
  }, [managedStations, selectedMode])


  // 마커 바텀시트 상태 (sheetArrivals useMemo보다 먼저 선언)
  const [sheetStation, setSheetStation] = useState(null)
  const [sheetBusArrivals, setSheetBusArrivals] = useState(null)
  const [sheetBusLoading, setSheetBusLoading] = useState(false)
  const [sheetDirection, setSheetDirection] = useState('outbound')

  useEffect(() => {
    if (!sheetStation) {
      setSheetBusArrivals(null)
      return
    }
    const stopId = getPrimaryStopId(sheetStation)
    if (!stopId) {
      setSheetBusArrivals(null)
      return
    }
    let cancelled = false
    setSheetBusLoading(true)
    apiFetch(`/bus/arrivals/${stopId}`)
      .then((res) => { if (!cancelled) setSheetBusArrivals(res ?? null) })
      .catch(() => { if (!cancelled) setSheetBusArrivals(null) })
      .finally(() => { if (!cancelled) setSheetBusLoading(false) })
    return () => { cancelled = true }
  }, [sheetStation])

  // MarkerSheet arrivals 계산
  const sheetArrivals = useMemo(() => {
    if (!sheetStation) return []

    if (sheetStation.type === 'bus' || sheetStation.type === 'bus_seoul') {
      const arrivals = sheetBusArrivals?.arrivals ?? []
      const nowBus = new Date()
      const seenRoutes = new Set()
      const result = []
      const isSeoulSide = sheetStation.type === 'bus_seoul' && !sheetStation.isLocalHub
      // bus_seoul: 마커에 등록된 노선만 표시 (같은 정류장의 무관한 노선 제거)
      const markerRouteNums = sheetStation.type === 'bus_seoul'
        ? new Set((sheetStation.routes ?? []).map((r) => r.route_number))
        : null
      for (const a of arrivals) {
        if (markerRouteNums && !markerRouteNums.has(a.route_no)) continue
        if (seenRoutes.has(a.route_no)) continue
        seenRoutes.add(a.route_no)

        let minutes
        if (a.arrival_type === 'timetable') {
          if (a.is_tomorrow) {
            minutes = `내일 ${a.depart_at}`
          } else if (a.depart_at) {
            const [h, m] = a.depart_at.split(':').map(Number)
            const t = new Date(nowBus); t.setHours(h, m, 0, 0)
            const diffSec = Math.floor((t - nowBus) / 1000)
            minutes = diffSec < 0 ? 0 : Math.ceil(diffSec / 60)
          } else {
            minutes = null
          }
        } else {
          minutes = a.arrive_in_seconds != null
            ? Math.max(0, Math.ceil(a.arrive_in_seconds / 60))
            : null
        }

        const rCfg = getRouteDisplayConfig(a.route_no)
        // 서울 측 마커: DB에 저장된 direction_name("학교행", "이마트(학교)" 등)을 그대로 사용
        // 로컬 허브: ROUTE_DISPLAY_CONFIG의 하교 방향 라벨 사용
        const directionLabel = isSeoulSide
          ? (a.destination ?? '학교행')
          : (rCfg?.direction ?? (a.destination ?? ''))
        result.push({
          routeCode:  a.route_no,
          routeColor: rCfg?.color ?? null,
          direction:  directionLabel,
          minutes,
          detail: {
            type:       'bus',
            routeCode:  a.route_no,
            routeId:    a.route_id ?? null,
            stopId:     sheetBusArrivals?.station_id ?? null,
            favCode:    `${a.category ?? (isSeoulSide ? '등교' : '하교')}:${a.route_no}`,
            mapLat:     sheetStation.lat ?? null,
            mapLng:     sheetStation.lng ?? null,
            isRealtime: a.arrival_type !== 'timetable',
            title:      a.destination ? `${a.route_no} · ${a.destination}` : `${a.route_no}번 버스`,
            accentColor: rCfg?.color ?? null,
          },
        })

        if (result.length >= 6) break
      }
      return result
    }

    if (sheetStation.type === 'shuttle') {
      // 하교(1) 또는 2캠 하교(3) = "from" 방향
      const isFrom = sheetStation.direction === 1 || sheetStation.direction === 3
      const isCampus2 = sheetStation.direction === 2 || sheetStation.direction === 3
      const schedByDir = {
        0: shuttleToSchoolSched,
        1: shuttleFromSchoolSched,
        2: shuttleToCampus2Sched,
        3: shuttleFromCampus2Sched,
      }
      const sched = schedByDir[sheetStation.direction]
      const dirData = sched?.directions?.find((d) => d.direction === sheetStation.direction)
      const times = dirData?.times ?? []
      const now = new Date()
      const upcoming = []
      for (const t of times) {
        const timeStr = (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5)
        const note = typeof t === 'object' ? t?.note : null
        if (!timeStr) continue
        const [h, m] = timeStr.split(':').map(Number)

        const tDate = new Date(now)
        tDate.setHours(h, m, 0, 0)
        if (tDate <= now) continue // 이미 지난 시간 건너뜀
        const diffMin = Math.ceil((tDate - now) / 60000)
        if (diffMin > 12 * 60) continue

        // 밤 11시 이후 또는 자정~새벽 5시에 100분 이상 남으면 첫차 라벨로 전환
        const _hs = now.getHours()
        const isLateNightGap = (_hs >= 23 || _hs < 5) && diffMin >= 100
        if (isLateNightGap) continue

        // 회차편은 본캠 등교(direction=0)에만 존재
        const isReturnTrip = sheetStation.direction === 0 && !!(note?.includes('회차편'))
        // note 예: "회차편 · 학교 21:20 출발" → HH:MM 추출
        const noteTimeMatch = isReturnTrip ? note?.match(/(\d{2}:\d{2})/) : null
        const hagyeoTimeStr = noteTimeMatch ? noteTimeMatch[1] : timeStr
        const shortLabel = isFrom ? '하교' : '등교'
        const dirLabel = isCampus2 ? `${shortLabel} (2캠)` : shortLabel
        upcoming.push({
          routeCode:  dirLabel,
          routeColor: '#1b3a6e',
          direction:  isReturnTrip ? '회차탑승' : (note ? `${timeStr} · ${note}` : timeStr),
          minutes:    isReturnTrip ? `하교 ${hagyeoTimeStr} 출발` : Math.max(0, diffMin),
          detail: {
            type: 'shuttle',
            routeCode: `셔틀${dirLabel}`,
            direction: sheetStation.direction,
            favCode:   `shuttle:${dirLabel}`,
            mapLat:    sheetStation.lat ?? null,
            mapLng:    sheetStation.lng ?? null,
            title:     `셔틀버스 ${dirLabel}`,
          },
        })
      }
      if (upcoming.length === 0 && times.length > 0) {
        const timeStrings = times.map(t => (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5))
        const shortLabel = isFrom ? '하교' : '등교'
        const dirLabel = isCampus2 ? `${shortLabel} (2캠)` : shortLabel
        upcoming.push({
          routeCode:  dirLabel,
          routeColor: '#1b3a6e',
          direction:  `${dirLabel} 셔틀`,
          minutes:    getFirstBusLabel(timeStrings, now),
          detail: {
            type: 'shuttle',
            routeCode: `셔틀${dirLabel}`,
            direction: sheetStation.direction,
            favCode:   `shuttle:${dirLabel}`,
            mapLat:    sheetStation.lat ?? null,
            mapLng:    sheetStation.lng ?? null,
            title:     `셔틀버스 ${dirLabel}`,
          },
        })
      }
      return upcoming
    }

    if (sheetStation.type === 'seohae') {
      const result = []
      const now = new Date()
      const upKey = sheetStation.tabId === 'choji' ? 'choji_up' : 'siheung_up'
      const dnKey = sheetStation.tabId === 'choji' ? 'choji_dn' : 'siheung_dn'
      const stationGroup = sheetStation.tabId === 'choji' ? '초지' : '시흥시청'

      // key를 routeCode에 포함시켜 상행/하행이 groupArrivalsByRoute에서 합쳐지지 않도록 함
      const addSeohae = (key, labelPrefix, defaultDest) => {
        const next = subwayNextData?.[key]
        const diffMin = next ? Math.max(0, Math.ceil(next.arrive_in_seconds / 60)) : null
        const _hSeohae = now.getHours()
        const isLateNightGap = next && (_hSeohae >= 23 || _hSeohae < 5) && diffMin >= 100
        const detailPayload = {
          type:        'subway',
          routeCode:   stationGroup,
          subwayKey:   key,
          favCode:     `subway:${stationGroup}:${key}`,
          mapLat:      sheetStation.lat ?? null,
          mapLng:      sheetStation.lng ?? null,
          accentColor: '#75bf43',
          title:       `${stationGroup}역 서해선 ${labelPrefix}`,
        }

        if (next && !isLateNightGap) {
          result.push({
            routeCode: `서해선:${key}`, routeColor: '#75bf43',
            direction: `${labelPrefix} · ${next.destination || defaultDest} 방면`,
            minutes: diffMin,
            detail: detailPayload,
          })
        } else {
          const trains = seohaeTimetable?.[key] ?? []
          if (trains.length > 0) {
            const timeStrings = trains.map(t => String(t.depart_at).slice(0, 5))
            result.push({
              routeCode: `서해선:${key}`, routeColor: '#75bf43',
              direction: `${labelPrefix} · ${trains[0]?.destination || defaultDest} 방면`,
              minutes: getFirstBusLabel(timeStrings, now),
              detail: detailPayload,
            })
          }
        }
      }

      addSeohae(upKey, '상행', '대곡')
      addSeohae(dnKey, '하행', '원시')

      // 시흥시청역: 등교 방향 버스 도착정보 병합
      if (sheetStation.tabId === 'siheung') {
        // 5602는 지선(파랑 B)이지만 DB엔 G/빨강으로 저장돼 있어 표시 단에서 덮어쓴다.
        const badgeFor = (routeNo, fallback) => routeNo === '5602' ? 'B' : fallback
        const colorFor = (routeNo, fallback) => routeNo === '5602' ? '#2563eb' : (fallback ?? '#DC2626')

        const busArrivals = busArrivalsSiheung?.arrivals ?? []
        for (const a of busArrivals) {
          if (a.category !== '등교') continue
          const routeMeta = sheetStation.routes.find((r) => r.route_number === a.route_no)
          const color = colorFor(a.route_no, routeMeta?.route_color)
          const badge = badgeFor(a.route_no, routeMeta?.badge_text)
          let mins
          if (a.arrival_type === 'timetable') {
            if (a.is_tomorrow) {
              mins = `내일 ${a.depart_at}`
            } else if (a.depart_at) {
              const [h, m] = a.depart_at.split(':').map(Number)
              const t = new Date(now); t.setHours(h, m, 0, 0)
              const diffSec = Math.floor((t - now) / 1000)
              mins = diffSec < 0 ? 0 : Math.ceil(diffSec / 60)
            } else {
              mins = null
            }
          } else {
            mins = a.arrive_in_seconds != null ? Math.max(0, Math.ceil(a.arrive_in_seconds / 60)) : null
          }
          result.push({
            routeCode:  badge ? `${badge}:${a.route_no}` : a.route_no,
            routeColor: color,
            direction:  a.destination ? `등교 · ${a.destination}` : '등교',
            minutes:    mins,
            detail: {
              type:       'bus',
              routeCode:  a.route_no,
              routeId:    a.route_id ?? null,
              stopId:     routeMeta?.outbound_stop_id ?? null,
              favCode:    `등교:${a.route_no}`,
              mapLat:     sheetStation.lat ?? null,
              mapLng:     sheetStation.lng ?? null,
              isRealtime: a.arrival_type !== 'timetable',
              title:      a.destination ? `${a.route_no} · ${a.destination}` : `${a.route_no}번 버스`,
              accentColor: color,
            },
          })
        }
      }

      return result
    }

    if (sheetStation.type === 'subway') {
      const result = []
      const now = new Date()

      // key를 routeCode에 포함시켜 상행/하행이 groupArrivalsByRoute에서 합쳐지지 않도록 함
      const addSubway = (key, routeCode, routeColor, labelPrefix, defaultDest) => {
        const uniqueCode = `${routeCode}:${key}`
        const next = subwayNextData?.[key]
        const diffMin = next ? Math.max(0, Math.ceil(next.arrive_in_seconds / 60)) : null
        const _hSubway = now.getHours()
        const isLateNightGap = next && (_hSubway >= 23 || _hSubway < 5) && diffMin >= 100
        const detailPayload = {
          type:        'subway',
          routeCode:   '정왕',
          subwayKey:   key,
          favCode:     `subway:정왕:${key}`,
          mapLat:      sheetStation.lat ?? null,
          mapLng:      sheetStation.lng ?? null,
          accentColor: routeColor,
          title:       `정왕역 ${routeCode} ${labelPrefix}`,
        }

        if (next && !isLateNightGap) {
          result.push({
            routeCode: uniqueCode, routeColor,
            direction: `${labelPrefix} · ${next.destination || defaultDest} 방면`,
            minutes: diffMin,
            detail: detailPayload,
          })
        } else {
          const trains = seohaeTimetable?.[key] ?? []
          if (trains.length > 0) {
            const timeStrings = trains.map(t => String(t.depart_at).slice(0, 5))
            result.push({
              routeCode: uniqueCode, routeColor,
              direction: `${labelPrefix} · ${trains[0]?.destination || defaultDest} 방면`,
              minutes: getFirstBusLabel(timeStrings, now),
              detail: detailPayload,
            })
          }
        }
      }

      addSubway('up',         '수인분당', '#F5A623', '상행', '왕십리')
      addSubway('down',       '수인분당', '#F5A623', '하행', '인천')
      addSubway('line4_up',   '4호선',   '#1B5FAD', '상행', '당고개')
      addSubway('line4_down', '4호선',   '#1B5FAD', '하행', '오이도')

      return result
    }

    return []
  }, [sheetStation, sheetDirection, sheetBusArrivals, busArrivalsSiheung, shuttleToSchoolSched, shuttleFromSchoolSched, shuttleToCampus2Sched, shuttleFromCampus2Sched, subwayNextData, seohaeTimetable])

  // GPS 소프트 프롬프트 훅
  const { promptState, checkAndShow: checkGps, hide: hideGpsPrompt } = useGpsSoftPrompt()

  const handleMarkerTap = useCallback((station) => {
    setSheetStation(station)
    const isSeoulSide = station.type === 'bus_seoul' && !station.isLocalHub
    setSheetDirection(isSeoulSide ? 'inbound' : 'outbound')
    onMarkerClick?.(station.id)
  }, [onMarkerClick])

  // 학교로 이동 버튼 핸들러
  function panToSchool() {
    if (!mapRef.current) return
    mapRef.current.panTo(new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng))
  }

  // 내 위치 FAB 핸들러 — GPS 권한 확인 후 소프트 프롬프트 또는 지도 이동
  // checkGps() 내부에서 권한 상태를 쿼리하여 promptState를 업데이트함.
  // promptState가 'granted'면 GpsSoftPrompt가 렌더되지 않아 조용히 처리됨.
  async function handleLocationFab() {
    await checkGps()
    // 이미 granted인 경우 — 현재 위치로 pan
    if (userLocation && mapRef.current) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
    }
  }

  function panTo(lat, lng) {
    if (!mapRef.current) return
    mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng))
  }

  // 다른 탭 갔다 돌아올 때 hidden → visible 전환 후 relayout
  useEffect(() => {
    if (activeTab === 'main' && mapRef.current) {
      requestAnimationFrame(() => {
        mapRef.current?.relayout()
      })
    }
  }, [activeTab])

  // 컨테이너 크기 변화 감지 → 카카오맵 relayout.
  // 모바일 스냅(지도↔대시보드)이 바뀔 때 CSS height transition(240ms)이 끝날 때까지 사이즈가
  // 여러 프레임에 걸쳐 변한다. ResizeObserver가 매 프레임 동기 relayout()을 호출하면
  // 전환 한 번에 reflow가 14프레임 연속 터진다(#7b).
  // → requestAnimationFrame으로 코얼레싱하여 한 프레임에 최대 1회만 relayout하고,
  //   전환 종료(transitionend) 시 최종 1회를 보장한다. (relayout이 일어나는 동작 자체는 유지)
  useEffect(() => {
    if (!mapInstance || !containerRef.current || typeof ResizeObserver === 'undefined') return
    const el = containerRef.current
    let rafId = null
    const scheduleRelayout = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        mapInstance.relayout()
      })
    }
    const observer = new ResizeObserver(scheduleRelayout)
    observer.observe(el)

    // 전환이 끝난 뒤 최종 사이즈로 한 번 더 보정 (관찰 대상은 부모 컨테이너의 height transition)
    const onTransitionEnd = (e) => {
      if (e.propertyName === 'height') scheduleRelayout()
    }
    const transitionTarget = el.parentElement
    transitionTarget?.addEventListener('transitionend', onTransitionEnd)

    return () => {
      observer.disconnect()
      transitionTarget?.removeEventListener('transitionend', onTransitionEnd)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [mapInstance])

  // 독 버튼/지도에서 보기 요청 pan — mapInstance 준비 이후 반드시 실행
  useEffect(() => {
    if (!mapPanTarget || !mapInstance) return
    mapInstance.panTo(new window.kakao.maps.LatLng(mapPanTarget.lat, mapPanTarget.lng))
    setMapPanTarget(null)
  }, [mapPanTarget, mapInstance, setMapPanTarget])

  // 지도 확장(mapExpanded) 진입 시 내 위치로 1회 센터링 (M-1).
  // GPS 권한이 없거나 아직 좌표가 오지 않았으면 기존 기본 센터(DEFAULT_CENTER)를 그대로 둔다.
  // 확장 세션당 1회만 동작하도록 ref로 막고, 축소되면 다음 확장에 다시 센터링하도록 리셋한다.
  useEffect(() => {
    if (!mapExpanded) {
      centeredOnExpandRef.current = false
      return
    }
    if (centeredOnExpandRef.current || !mapInstance || !gpsCoords) return
    mapInstance.panTo(new window.kakao.maps.LatLng(gpsCoords[0], gpsCoords[1]))
    centeredOnExpandRef.current = true
  }, [mapExpanded, mapInstance, gpsCoords])

  // SDK 로드 effect
  useEffect(() => {
    if (!kakaoKey) return

    if (window.kakao?.maps?.LatLng) {
      setSdkReady(true)
      return
    }

    let isMounted = true

    function onSdkLoaded() {
      if (!window.kakao?.maps?.load) {
        console.error('[MapView] kakao.maps.load not available after script load')
        return
      }
      window.kakao.maps.load(() => {
        if (isMounted) setSdkReady(true)
      })
    }

    const existing = document.getElementById(SDK_SCRIPT_ID)
    if (existing) {
      if (window.kakao?.maps?.load) {
        onSdkLoaded()
        return () => { isMounted = false }
      }
      existing.addEventListener('load', onSdkLoaded, { once: true })
      return () => {
        isMounted = false
        existing.removeEventListener('load', onSdkLoaded)
      }
    }

    const script = document.createElement('script')
    script.id = SDK_SCRIPT_ID
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`
    script.onload = onSdkLoaded
    script.onerror = () => console.error('[MapView] Failed to load Kakao Maps SDK — check API key and allowed domains')
    document.head.appendChild(script)

    return () => { isMounted = false }
  }, [kakaoKey])

  // 지도 초기화 effect (sdkReady 후 1회)
  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) return

    const map = new window.kakao.maps.Map(containerRef.current, {
      center: new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: 4,
    })
    mapRef.current = map

    // 탭 전환 후 복귀 시 이전 중심/줌 복원 (초기 mount 1회만)
    const savedView = useAppStore.getState().mapView
    if (savedView) {
      map.setCenter(new window.kakao.maps.LatLng(savedView.center[0], savedView.center[1]))
      map.setLevel(savedView.level)
    }

    // idle 이벤트마다 현재 중심/줌을 스토어에 저장 (pan/zoom 종료 시점)
    const onIdle = () => {
      const c = map.getCenter()
      useAppStore.getState().setMapView({
        center: [c.getLat(), c.getLng()],
        level: map.getLevel(),
      })
    }
    window.kakao.maps.event.addListener(map, 'idle', onIdle)

    setMapInstance(map)

    return () => {
      window.kakao.maps.event.removeListener(map, 'idle', onIdle)
      mapRef.current = null
      setMapInstance(null)
    }
  }, [sdkReady])

  if (!kakaoKey) {
    return (
      <div className="flex-1 relative w-full h-full min-h-0 bg-surface-2 dark:bg-surface overflow-hidden select-none">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-mute text-base font-medium">카카오맵 (API 키 설정 후 활성화)</p>
        </div>
      </div>
    )
  }

  if (!sdkReady) {
    return (
      <div className="flex-1 relative w-full h-full min-h-0 bg-surface-2 dark:bg-surface overflow-hidden select-none">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-mute text-base font-medium">지도를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // NearestStopCard(M-1)용 위치·도착 데이터 — 둘 다 이미 이 컴포넌트가 들고 있는
  // 값을 그대로 넘긴다(새 fetch 없음). gpsCoords(방금 받은 좌표)를 store의
  // userLocation보다 우선한다 — 지도를 막 확장한 시점엔 이 값이 더 최신이다.
  const nearestUserLocation = gpsCoords
    ? { lat: gpsCoords[0], lng: gpsCoords[1] }
    : userLocation
  const arrivalsByStation = {
    '한국공학대': busArrivalsData,
    '이마트': busArrivalsEmart,
    '시흥시청': busArrivalsSiheung,
  }

  return (
    <>
      {/*
        ┌─ 외부 상대 컨테이너 ─────────────────────────────────────────┐
        │  ┌─ 카카오맵 캔버스 (절대 배치, 다크 필터 적용) ─────────┐  │
        │  │  SDK가 이 div 안에만 렌더링                           │  │
        │  └────────────────────────────────────────────────────────┘  │
        │  ┌─ React UI 오버레이 (필터 없음) ────────────────────────┐  │
        │  │  FAB 버튼, TaxiCard, MarkerSheet                      │  │
        │  └────────────────────────────────────────────────────────┘  │
        └──────────────────────────────────────────────────────────────┘
      */}
      <div className="flex-1 relative w-full h-full min-h-0">

        {/* 카카오맵 SDK 전용 컨테이너 — CSS에서 canvas에만 필터 적용 (마커 div 제외)
            touchAction: 'none' — 터치 스크린 PC/태블릿에서 브라우저가 single-finger 드래그를
            네이티브 스크롤로 가로채는 것을 막아 SDK가 pan/pinch를 처리하도록 한다. */}
        <div
          ref={containerRef}
          id="kakao-map-canvas"
          className="absolute inset-0 bg-surface-2"
          style={{ touchAction: 'none' }}
        />

        {/* mapExpanded=false(기본) — 기존 우하단 FAB 배치(PC 등 mapExpanded 미사용 호출부 호환) */}
        {mapInstance && !mapExpanded && (
          <div
            className="absolute right-4 flex flex-col gap-2 z-[50]"
            style={{ bottom: '4.75rem' }}
          >
            {/* 내 위치 FAB */}
            <button
              className="w-9 h-9 rounded-full bg-surface dark:bg-surface shadow-pill flex items-center justify-center active:scale-[0.94] transition-transform duration-press ease-spring"
              onClick={handleLocationFab}
              aria-label="내 위치"
              title="내 위치"
            >
              <Navigation size={17} className="text-accent dark:text-accent" />
            </button>
            {/* 학교로 FAB */}
            <button
              className="w-9 h-9 rounded-full bg-surface dark:bg-surface shadow-pill flex items-center justify-center active:scale-[0.94] transition-transform duration-press ease-spring"
              onClick={panToSchool}
              aria-label="학교로"
              title="학교로"
            >
              <School size={17} className="text-navy" />
            </button>
          </div>
        )}

        {/* mapExpanded=true(M-1) — 검색 pill(상단 전폭) + 우측 상단 세로 컨트롤 스택
            (닫기 · 내 위치 · 학교로, 검색바 아래) + 하단 최근접 정류장 카드.
            top/bottom 모두 safe-area-inset을 더해 노치·홈 인디케이터를 피한다. */}
        {mapInstance && mapExpanded && (
          <>
            <button
              type="button"
              onClick={() => setSearchOpen?.(true)}
              aria-label="노선 · 정류장 검색"
              className="absolute left-3 right-3 z-[55] flex items-center gap-2 h-11 px-4
                         bg-surface dark:bg-surface border border-line dark:border-line
                         rounded-pill shadow-pill text-caption text-mute dark:text-mute
                         active:scale-[0.98] transition-transform duration-press ease-spring"
              style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
            >
              <Search size={16} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
              <span className="truncate">노선 · 정류장 검색</span>
            </button>

            <div
              className="absolute right-4 flex flex-col gap-2 z-[55]"
              style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}
            >
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label="지도 닫기"
                  className="flex items-center gap-1.5 bg-surface/95 dark:bg-surface/95
                             border border-line dark:border-line rounded-card px-3 py-2
                             text-[13px] font-bold text-accent dark:text-accent shadow-pill
                             min-h-[40px] active:scale-[0.94] transition-transform duration-press ease-spring"
                >
                  <MapIcon size={16} aria-hidden="true" />
                  닫기
                </button>
              )}
              {/* 내 위치 FAB */}
              <button
                className="w-9 h-9 rounded-full bg-surface dark:bg-surface shadow-pill flex items-center justify-center active:scale-[0.94] transition-transform duration-press ease-spring"
                onClick={handleLocationFab}
                aria-label="내 위치"
                title="내 위치"
              >
                <Navigation size={17} className="text-accent dark:text-accent" />
              </button>
              {/* 학교로 FAB */}
              <button
                className="w-9 h-9 rounded-full bg-surface dark:bg-surface shadow-pill flex items-center justify-center active:scale-[0.94] transition-transform duration-press ease-spring"
                onClick={panToSchool}
                aria-label="학교로"
                title="학교로"
              >
                <School size={17} className="text-navy" />
              </button>
            </div>

            <NearestStopCard
              userLocation={nearestUserLocation}
              direction={effectiveDirection}
              arrivalsByStation={arrivalsByStation}
              onSelectStation={handleMarkerTap}
              onRequestGps={handleLocationFab}
            />
          </>
        )}

        {/* GPS 소프트 프롬프트 */}
        {(promptState === 'prompt' || promptState === 'denied') && (
          <GpsSoftPrompt
            permissionState={promptState}
            onClose={hideGpsPrompt}
            onGranted={({ coords }) => {
              useAppStore.getState().setUserLocation({ lat: coords.latitude, lng: coords.longitude })
              if (mapRef.current) {
                mapRef.current.panTo(new window.kakao.maps.LatLng(coords.latitude, coords.longitude))
              }
            }}
          />
        )}

        {/* 도보 경로 카드 */}
        <WalkRouteCard />

        {/* 마커 탭 → 바텀시트 */}
        {sheetStation && (
          <MarkerSheet
            station={sheetStation}
            arrivals={sheetArrivals}
            onArrivalClick={(detail) => {
              // 상세 시트/모달을 새로 열기 전에 이 마커 시트부터 닫는다 — 안 닫으면
              // MarkerSheet가 새로 열린 시트 뒤에 그대로 남아 두 시트가 겹쳐 보인다.
              setSheetStation(null)
              if (detail.type === 'subway') {
                // 지하철은 통합 상세 패널로 연결
                useAppStore.getState().setSubwayDetailSheet({
                  station: detail.routeCode, // '정왕', '초지', '시흥시청'
                  lineName: detail.title.includes('수인분당') ? '수인분당선' : (detail.title.includes('4호선') ? '4호선' : '서해선'),
                  timetableKey: detail.subwayKey,
                  direction: detail.title.includes('상행') ? '상행' : '하행',
                  color: detail.accentColor,
                  darkColor: detail.accentColor,
                  lightColor: '#f8f8f8',
                  symbol: detail.title.includes('수인분당') ? '수' : (detail.title.includes('4호선') ? '4' : '서'),
                })
              } else {
                // 버스 등은 기존대로 상세 모달
                useAppStore.getState().setDetailModal(detail)
              }
            }}
            relatedMarkers={[]}
            onRelatedMarker={(key) => {
              const target = managedStations.find((s) => s.id === key)
              if (target) { setSheetDirection('outbound'); setSheetStation(target) }
            }}
            directionControl={null}
            onClose={() => setSheetStation(null)}
            onNavigate={async () => {
              const destLat = sheetStation.lat
              const destLng = sheetStation.lng
              const destName = sheetStation.name ?? '목적지'
              const origin = userLocation?.lat && userLocation?.lng
                ? { lat: userLocation.lat, lng: userLocation.lng }
                : { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng }
              setSheetStation(null)
              try {
                const result = await apiFetch('/route/walking', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    origin,
                    destination: { lat: destLat, lng: destLng },
                  }),
                })
                useAppStore.getState().setWalkRoute({
                  coords: result.coordinates ?? [],
                  destName,
                  durationSec: result.duration_seconds,
                  distanceM: result.distance_meters,
                })
              } catch (err) {
                console.warn('도보 경로 탐색 실패:', err)
              }
            }}
            onDetail={() => {
              const hint =
                sheetStation.type === 'shuttle'
                  ? { mode: 'shuttle' }
                  : sheetStation.type === 'subway'
                  ? { mode: 'subway', group: '정왕' }
                  : sheetStation.type === 'bus'
                  ? { mode: 'bus', group: '정왕역행' }
                  : sheetStation.type === 'bus_seoul'
                  ? { mode: 'bus', group: '버스 - 서울행', routeCode: sheetStation.route }
                  : sheetStation.type === 'seohae'
                  ? { mode: 'subway', group: sheetStation.tabId === 'choji' ? '초지' : '시흥시청' }
                  : null
              setSheetStation(null)
              if (hint) {
                useAppStore.getState().setScheduleHint(hint)
                if (window.location.pathname !== '/schedule') {
                  window.history.pushState({}, '', '/schedule')
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }
              }
            }}
          />
        )}
      </div>

      {/* map 인스턴스가 준비된 후 오버레이 컴포넌트 마운트 */}
      {mapInstance && (
        <>
          <UserLocationMarker map={mapInstance} />
          <DriveRoutePolyline map={mapInstance} />
          <WalkRoutePolyline map={mapInstance} />
          <RestaurantOverlay map={mapInstance} />
          <TrafficRoadOverlay map={mapInstance} />

          {/* 줌 레벨 기반 Chip ↔ Dot 하이브리드 마커 (주요 정류장) */}
          <ZoomAwareOverlayManager
            map={mapInstance}
            stations={visibleStations}
            onTap={handleMarkerTap}
          />
        </>
      )}
    </>
  )
}
