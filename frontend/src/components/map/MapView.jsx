import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Navigation, School } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import UserLocationMarker from './UserLocationMarker'
import SeohaeStopOverlay from './SeohaeStopOverlay'
import TaxiCard from './TaxiCard'
import DriveRoutePolyline from './DriveRoutePolyline'
import WalkRoutePolyline from './WalkRoutePolyline'
import WalkRouteCard from './WalkRouteCard'
import { apiFetch } from '../../hooks/useApi'
import RestaurantOverlay from './RestaurantOverlay'
import TrafficRoadOverlay from './TrafficRoadOverlay'
import ZoomAwareOverlayManager from './ZoomAwareOverlayManager'
import MarkerSheet from './MarkerSheet'
import GpsSoftPrompt, { useGpsSoftPrompt } from './GpsSoftPrompt'
import { useShuttleNext, useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'
import { useBusArrivals, useBusStations, useBusTimetableByRoute } from '../../hooks/useBus'

// 한국공학대학교 정문 좌표
const DEFAULT_CENTER = { lat: 37.3400, lng: 126.7335 }
const SDK_SCRIPT_ID = 'kakao-map-sdk'


export default function MapView({ onMarkerClick, selectedId }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [sdkReady, setSdkReady] = useState(() => Boolean(window.kakao?.maps?.LatLng))
  const [mapInstance, setMapInstance] = useState(null)
  const kakaoKey = import.meta.env.VITE_KAKAO_JS_APP_KEY
  const userLocation        = useAppStore((s) => s.userLocation)
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const mapPanTarget        = useAppStore((s) => s.mapPanTarget)
  const setMapPanTarget     = useAppStore((s) => s.setMapPanTarget)
  const taxiOpen            = useAppStore((s) => s.taxiOpen)
  const setTaxiOpen         = useAppStore((s) => s.setTaxiOpen)
  const activeTab           = useAppStore((s) => s.activeTab)

  // 실시간 데이터 훅
  const { data: shuttleToSchoolData }   = useShuttleNext(0) // 등교: 정왕역 → 학교
  const { data: shuttleFromSchoolData } = useShuttleNext(1) // 하교: 학교 → 정왕역
  const { data: shuttleToSchoolSched }  = useShuttleSchedule(0)
  const { data: shuttleFromSchoolSched } = useShuttleSchedule(1)
  const { data: subwayNextData }        = useSubwayNext()
  const { data: busArrivalsData }       = useBusArrivals(224000639)
  const { data: stationsData }          = useBusStations()

  // 정류장 이름 → stop_id 해석
  const stopIds = useMemo(() => {
    const stations = stationsData ?? []
    const byName = (name) => stations.find((s) => s.name === name)?.station_id ?? null
    return {
      sihwa:   byName('시화 (3400 시종착)'),
      emart:   byName('이마트 (6502·시흥1번 정류장)'),
      sadang:  byName('사당역 14번 출구'),
      gangnam: byName('강남역 3400 정류장'),
    }
  }, [stationsData])

  const { data: timetable3400Out } = useBusTimetableByRoute('3400', { stopId: stopIds.sihwa })
  const { data: timetable3400In  } = useBusTimetableByRoute('3400', { stopId: stopIds.gangnam })
  const { data: timetable6502Out } = useBusTimetableByRoute('6502', { stopId: stopIds.emart })
  const { data: timetable6502In  } = useBusTimetableByRoute('6502', { stopId: stopIds.sadang })

  // liveMinutes 계산
  const shuttleToSchoolMins = useMemo(() => {
    const sec = shuttleToSchoolData?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.round(sec / 60))
  }, [shuttleToSchoolData])

  const shuttleFromSchoolMins = useMemo(() => {
    const sec = shuttleFromSchoolData?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.round(sec / 60))
  }, [shuttleFromSchoolData])

  const subwayLiveMinutes = useMemo(() => {
    const sec = subwayNextData?.up?.arrive_in_seconds ?? subwayNextData?.down?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.round(sec / 60))
  }, [subwayNextData])

  const busLiveMinutes = useMemo(() => {
    const arrivals = busArrivalsData?.arrivals ?? []
    if (!arrivals.length) return null
    const secs = arrivals
      .map((a) => a.arrive_in_seconds)
      .filter((s) => s != null)
    if (!secs.length) return null
    return Math.max(0, Math.round(Math.min(...secs) / 60))
  }, [busArrivalsData])

  const minsUntilNextTimetable = (timetable) => {
    const times = timetable?.times ?? []
    if (!times.length) return null
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    for (const t of times) {
      const [hh, mm] = String(t).split(':').map(Number)
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue
      const diff = hh * 60 + mm - nowMin
      if (diff >= 0) return diff
    }
    return null
  }

  const bus3400OutMinutes = useMemo(() => minsUntilNextTimetable(timetable3400Out), [timetable3400Out])
  const bus3400InMinutes  = useMemo(() => minsUntilNextTimetable(timetable3400In),  [timetable3400In])
  const bus6502OutMinutes = useMemo(() => minsUntilNextTimetable(timetable6502Out), [timetable6502Out])
  const bus6502InMinutes  = useMemo(() => minsUntilNextTimetable(timetable6502In),  [timetable6502In])

  // MANAGED_STATIONS with live data injected
  const managedStations = useMemo(() => [
    {
      id: 'shuttle_to_school',
      name: '등교',
      type: 'shuttle',
      direction: 0,
      lat: 37.351134,
      lng: 126.742043,
      routeCode: '등교',
      routeColor: '#FF385C',
      liveMinutes: shuttleToSchoolMins,
      showLive: true,
    },
    {
      id: 'shuttle_from_school',
      name: '하교',
      type: 'shuttle',
      direction: 1,
      lat: 37.339343,
      lng: 126.73279,
      routeCode: '하교',
      routeColor: '#FF385C',
      liveMinutes: shuttleFromSchoolMins,
      showLive: true,
    },
    {
      id: 'jeongwang_station',
      name: '정왕역',
      type: 'subway',
      lat: 37.352618,
      lng: 126.742747,
      routeCode: '수인분당',
      routeColor: '#F5A623',
      liveMinutes: subwayLiveMinutes,
      showLive: true,
      chipVariant: 'subwayMulti',
      subwayData: subwayNextData ?? null,
    },
    {
      id: 'tec_bus_stop',
      name: '한국공대',
      type: 'bus',
      lat: 37.341633,
      lng: 126.731252,
      routeCode: '33번',
      routeColor: '#0891B2',
      liveMinutes: busLiveMinutes,
      showLive: true,
      liveInaccurate: true,
    },
    {
      id: 'bus_3400_stop',
      name: '3400',
      type: 'bus_seoul',
      route: '3400',
      lat: 37.342546,
      lng: 126.735365,
      routeCode: '3400',
      routeColor: '#DC2626',
      badgeText: 'G',
      liveMinutes: bus3400OutMinutes,
      showLive: true,
      outboundStopId: stopIds.sihwa,
      inboundStopId:  stopIds.gangnam,
      outboundSegment: '서울행',
      inboundSegment:  '정왕행',
      outboundDirLabel: '학교 → 강남행',
      inboundDirLabel:  '강남 → 학교행',
      spineLeft: '시화', spineRight: '강남',
      outboundActiveSide: 'right',
      inboundActiveSide:  'left',
    },
    {
      id: 'bus_6502_stop',
      name: '6502',
      type: 'bus_seoul',
      route: '6502',
      lat: 37.345999,
      lng: 126.737995,
      routeCode: '6502',
      routeColor: '#DC2626',
      badgeText: 'G',
      liveMinutes: bus6502OutMinutes,
      showLive: true,
      outboundStopId: stopIds.emart,
      inboundStopId:  stopIds.sadang,
      outboundSegment: '서울행',
      inboundSegment:  '정왕행',
      outboundDirLabel: '이마트 → 사당행',
      inboundDirLabel:  '사당 → 이마트행',
      spineLeft: '이마트', spineRight: '사당',
      outboundActiveSide: 'right',
      inboundActiveSide:  'left',
    },
    {
      id: 'bus_3400_gangnam',
      name: '3400',
      type: 'bus_seoul',
      route: '3400',
      lat: 37.498427,
      lng: 127.029829,
      routeCode: '3400',
      routeColor: '#DC2626',
      badgeText: 'G',
      liveMinutes: bus3400InMinutes,
      showLive: true,
      outboundStopId: stopIds.gangnam,
      inboundStopId:  stopIds.sihwa,
      outboundSegment: '정왕행',
      inboundSegment:  '서울행',
      outboundDirLabel: '강남 → 학교행',
      inboundDirLabel:  '학교 → 강남행',
      spineLeft: '시화', spineRight: '강남',
      outboundActiveSide: 'left',
      inboundActiveSide:  'right',
    },
    {
      id: 'bus_6502_sadang',
      name: '6502',
      type: 'bus_seoul',
      route: '6502',
      lat: 37.476654,
      lng: 126.982610,
      routeCode: '6502',
      routeColor: '#DC2626',
      badgeText: 'G',
      liveMinutes: bus6502InMinutes,
      showLive: true,
      outboundStopId: stopIds.sadang,
      inboundStopId:  stopIds.emart,
      outboundSegment: '정왕행',
      inboundSegment:  '서울행',
      outboundDirLabel: '사당 → 이마트행',
      inboundDirLabel:  '이마트 → 사당행',
      spineLeft: '이마트', spineRight: '사당',
      outboundActiveSide: 'left',
      inboundActiveSide:  'right',
    },
  ], [shuttleToSchoolMins, shuttleFromSchoolMins, subwayLiveMinutes, busLiveMinutes, bus3400OutMinutes, bus3400InMinutes, bus6502OutMinutes, bus6502InMinutes, subwayNextData, stopIds])

  // 마커 바텀시트 상태 (sheetArrivals useMemo보다 먼저 선언)
  const [sheetStation, setSheetStation] = useState(null)
  const [sheetDirection, setSheetDirection] = useState('outbound')

  // MarkerSheet arrivals 계산
  const sheetArrivals = useMemo(() => {
    if (!sheetStation) return []

    if (sheetStation.type === 'bus') {
      const arrivals = busArrivalsData?.arrivals ?? []
      return arrivals.slice(0, 3).map((a) => ({
        routeCode:  a.route_no,
        routeColor: null,
        direction:  a.destination ?? '',
        minutes:    a.arrive_in_seconds != null ? Math.max(0, Math.round(a.arrive_in_seconds / 60)) : null,
      }))
    }

    if (sheetStation.type === 'bus_seoul') {
      const isOutbound = sheetDirection === 'outbound'
      const wantStopId = isOutbound ? sheetStation.outboundStopId : sheetStation.inboundStopId
      const label      = isOutbound ? sheetStation.outboundDirLabel : sheetStation.inboundDirLabel

      const pickTimetable = () => {
        if (sheetStation.route === '3400') {
          if (wantStopId === stopIds.sihwa)   return timetable3400Out
          if (wantStopId === stopIds.gangnam) return timetable3400In
        } else if (sheetStation.route === '6502') {
          if (wantStopId === stopIds.emart)  return timetable6502Out
          if (wantStopId === stopIds.sadang) return timetable6502In
        }
        return null
      }
      const timetable = pickTimetable()
      const times = timetable?.times ?? []
      const notes = timetable?.notes ?? []
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const upcoming = []
      for (let i = 0; i < times.length; i++) {
        const t = times[i]
        const [hh, mm] = String(t).split(':').map(Number)
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue
        const diff = hh * 60 + mm - nowMin
        if (diff < 0) continue
        const note = notes[i]
        upcoming.push({
          routeCode:  'G',
          routeColor: '#DC2626',
          direction:  note ? `${sheetStation.route} · ${label} · ${note}` : `${sheetStation.route} · ${label}`,
          minutes:    diff,
        })
        if (upcoming.length >= 3) break
      }
      return upcoming
    }

    if (sheetStation.type === 'shuttle') {
      const isFrom = sheetStation.direction === 1
      const sched = isFrom ? shuttleFromSchoolSched : shuttleToSchoolSched
      const dirData = sched?.directions?.find((d) => d.direction === sheetStation.direction)
      const times = dirData?.times ?? []
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const upcoming = []
      for (const t of times) {
        const timeStr = (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5)
        const note = typeof t === 'object' ? t?.note : null
        if (!timeStr) continue
        const [h, m] = timeStr.split(':').map(Number)
        const mins = h * 60 + m - nowMin
        if (mins < -1) continue
        upcoming.push({
          routeCode:  isFrom ? '하교' : '등교',
          routeColor: '#FF385C',
          direction:  note ? `${timeStr} · ${note}` : timeStr,
          minutes:    Math.max(0, mins),
        })
      }
      return upcoming
    }

    if (sheetStation.type === 'subway') {
      const result = []
      if (subwayNextData?.up) {
        result.push({
          routeCode:  '수인분당',
          routeColor: '#F5A623',
          direction:  `상행 · ${subwayNextData.up.destination ?? '왕십리'} 방면`,
          minutes:    Math.max(0, Math.round(subwayNextData.up.arrive_in_seconds / 60)),
        })
      }
      if (subwayNextData?.down) {
        result.push({
          routeCode:  '수인분당',
          routeColor: '#F5A623',
          direction:  `하행 · ${subwayNextData.down.destination ?? '인천'} 방면`,
          minutes:    Math.max(0, Math.round(subwayNextData.down.arrive_in_seconds / 60)),
        })
      }
      if (subwayNextData?.line4_up) {
        result.push({
          routeCode:  '4호선',
          routeColor: '#1B5FAD',
          direction:  `상행 · ${subwayNextData.line4_up.destination ?? '당고개'} 방면`,
          minutes:    Math.max(0, Math.round(subwayNextData.line4_up.arrive_in_seconds / 60)),
        })
      }
      if (subwayNextData?.line4_down) {
        result.push({
          routeCode:  '4호선',
          routeColor: '#1B5FAD',
          direction:  `하행 · ${subwayNextData.line4_down.destination ?? '오이도'} 방면`,
          minutes:    Math.max(0, Math.round(subwayNextData.line4_down.arrive_in_seconds / 60)),
        })
      }
      return result
    }

    return []
  }, [sheetStation, sheetDirection, busArrivalsData, shuttleToSchoolSched, shuttleFromSchoolSched, subwayNextData, timetable3400Out, timetable3400In, timetable6502Out, timetable6502In, stopIds])

  // GPS 소프트 프롬프트 훅
  const { promptState, checkAndShow: checkGps, hide: hideGpsPrompt } = useGpsSoftPrompt()

  const handleMarkerTap = useCallback((station) => {
    setSheetStation(station)
    setSheetDirection('outbound')
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

  // 독 버튼에서 요청한 pan 처리
  useEffect(() => {
    if (!mapPanTarget || !mapRef.current) return
    panTo(mapPanTarget.lat, mapPanTarget.lng)
    setMapPanTarget(null)
  }, [mapPanTarget])

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

    setMapInstance(map)

    return () => {
      mapRef.current = null
      setMapInstance(null)
    }
  }, [sdkReady])

  if (!kakaoKey) {
    return (
      <div className="flex-1 relative bg-slate-200 dark:bg-slate-800 overflow-hidden select-none">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-slate-400 text-base font-medium">카카오맵 (API 키 설정 후 활성화)</p>
        </div>
      </div>
    )
  }

  if (!sdkReady) {
    return (
      <div className="flex-1 relative bg-slate-200 dark:bg-slate-800 overflow-hidden select-none">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-slate-400 text-base font-medium">지도를 불러오는 중...</p>
        </div>
      </div>
    )
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
      <div className="flex-1 relative" style={{ minHeight: 300 }}>

        {/* 카카오맵 SDK 전용 컨테이너 — CSS에서 canvas에만 필터 적용 (마커 div 제외) */}
        <div
          ref={containerRef}
          id="kakao-map-canvas"
          className="absolute inset-0 bg-slate-200"
        />

        {/* 우하단 플로팅 버튼 (§2.8): 내 위치, 학교로 */}
        {mapInstance && (
          <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-[50]">
            {/* 내 위치 FAB */}
            <button
              className="w-9 h-9 rounded-full bg-white dark:bg-[#272a33] shadow-pill flex items-center justify-center active:scale-95 transition-transform"
              onClick={handleLocationFab}
              aria-label="내 위치"
              title="내 위치"
            >
              <Navigation size={17} className="text-coral" />
            </button>
            {/* 학교로 FAB */}
            <button
              className="w-9 h-9 rounded-full bg-white dark:bg-[#272a33] shadow-pill flex items-center justify-center active:scale-95 transition-transform"
              onClick={panToSchool}
              aria-label="학교로"
              title="학교로"
            >
              <School size={17} className="text-navy" />
            </button>
          </div>
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

        {/* 택시 카드 — taxiOpen일 때만 마운트 */}
        {mapInstance && taxiOpen && (
          <TaxiCard
            open={taxiOpen}
            onClose={() => {
              setTaxiOpen(false)
              setDriveRouteCoords(null)
            }}
          />
        )}

        {/* 마커 탭 → 바텀시트 */}
        {sheetStation && (
          <MarkerSheet
            station={sheetStation}
            arrivals={sheetArrivals}
            directionControl={sheetStation.type === 'bus_seoul' ? {
              direction: sheetDirection,
              onChange:  setSheetDirection,
              leftLabel:  sheetStation.spineLeft,
              rightLabel: sheetStation.spineRight,
              activeSide: sheetDirection === 'outbound' ? sheetStation.outboundActiveSide : sheetStation.inboundActiveSide,
              outboundLabel: sheetStation.outboundSegment,
              inboundLabel:  sheetStation.inboundSegment,
              placeholder: sheetArrivals.length === 0
                ? (sheetStation.route === '3400' && sheetDirection === 'inbound'
                    ? '주말·공휴일 강남 출발 시간표 자료 없음'
                    : '도착 정보가 없습니다')
                : null,
            } : null}
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
              const tabId =
                sheetStation.type === 'shuttle'   ? 'shuttle' :
                sheetStation.type === 'subway'    ? 'jeongwang' :
                sheetStation.type === 'bus'       ? 'jeongwang' :
                sheetStation.type === 'bus_seoul' ? 'seoul' :
                null
              if (tabId) useAppStore.getState().setOpenInfoTab(tabId)
              setSheetStation(null)
            }}
          />
        )}
      </div>

      {/* map 인스턴스가 준비된 후 오버레이 컴포넌트 마운트 */}
      {mapInstance && (
        <>
          <UserLocationMarker map={mapInstance} />
          <SeohaeStopOverlay map={mapInstance} />
          <DriveRoutePolyline map={mapInstance} />
          <WalkRoutePolyline map={mapInstance} />
          <RestaurantOverlay map={mapInstance} />
          <TrafficRoadOverlay map={mapInstance} />

          {/* 줌 레벨 기반 Chip ↔ Dot 하이브리드 마커 (주요 정류장) */}
          <ZoomAwareOverlayManager
            map={mapInstance}
            stations={managedStations}
            onTap={handleMarkerTap}
          />
        </>
      )}
    </>
  )
}
