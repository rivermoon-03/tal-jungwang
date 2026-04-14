import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Navigation, School } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import UserLocationMarker from './UserLocationMarker'
import SeohaeStopOverlay from './SeohaeStopOverlay'
import JeongwangShuttleOverlay from './JeongwangShuttleOverlay'
import TaxiCard from './TaxiCard'
import DriveRoutePolyline from './DriveRoutePolyline'
import RestaurantOverlay from './RestaurantOverlay'
import TrafficRoadOverlay from './TrafficRoadOverlay'
import ZoomAwareOverlayManager from './ZoomAwareOverlayManager'
import MarkerSheet from './MarkerSheet'
import GpsSoftPrompt, { useGpsSoftPrompt } from './GpsSoftPrompt'
import { useShuttleNext } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'
import { useBusArrivals } from '../../hooks/useBus'

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
  const { data: shuttleNextData }  = useShuttleNext()
  const { data: subwayNextData }   = useSubwayNext()
  const { data: busArrivalsData }  = useBusArrivals(224000639)

  // liveMinutes 계산
  const shuttleLiveMinutes = useMemo(() => {
    const sec = shuttleNextData?.arrive_in_seconds
    if (sec == null) return null
    return Math.max(0, Math.round(sec / 60))
  }, [shuttleNextData])

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

  // MANAGED_STATIONS with live data injected
  const managedStations = useMemo(() => [
    {
      id: 'shuttle_stop',
      name: '셔틀 탑승지',
      type: 'shuttle',
      lat: 37.339343,
      lng: 126.73279,
      routeCode: '셔틀',
      routeColor: '#FF385C',
      liveMinutes: shuttleLiveMinutes,
      showLive: true,
    },
    {
      id: 'jeongwang_station',
      name: '정왕역',
      type: 'subway',
      lat: 37.351618,
      lng: 126.742747,
      routeCode: '수인분당',
      routeColor: '#F5A623',
      liveMinutes: subwayLiveMinutes,
      showLive: true,
    },
    {
      id: 'tec_bus_stop',
      name: '한국공학대학교',
      type: 'bus',
      lat: 37.341633,
      lng: 126.731252,
      routeCode: '시흥33',
      routeColor: '#0891B2',
      liveMinutes: busLiveMinutes,
      showLive: true,
    },
  ], [shuttleLiveMinutes, subwayLiveMinutes, busLiveMinutes])

  // 마커 바텀시트 상태 (sheetArrivals useMemo보다 먼저 선언)
  const [sheetStation, setSheetStation] = useState(null)

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

    if (sheetStation.type === 'shuttle') {
      const result = []
      if (shuttleNextData) {
        result.push({
          routeCode:  '셔틀',
          routeColor: '#FF385C',
          direction:  shuttleNextData.direction === 0 ? '등교' : '하교',
          minutes:    shuttleNextData.arrive_in_seconds != null
            ? Math.max(0, Math.round(shuttleNextData.arrive_in_seconds / 60))
            : null,
        })
      }
      return result
    }

    if (sheetStation.type === 'subway') {
      const result = []
      if (subwayNextData?.up) {
        result.push({
          routeCode:  '수인분당',
          routeColor: '#F5A623',
          direction:  subwayNextData.up.destination ?? '상행',
          minutes:    Math.max(0, Math.round(subwayNextData.up.arrive_in_seconds / 60)),
        })
      }
      if (subwayNextData?.down) {
        result.push({
          routeCode:  '수인분당',
          routeColor: '#F5A623',
          direction:  subwayNextData.down.destination ?? '하행',
          minutes:    Math.max(0, Math.round(subwayNextData.down.arrive_in_seconds / 60)),
        })
      }
      return result
    }

    return []
  }, [sheetStation, busArrivalsData, shuttleNextData, subwayNextData])

  // GPS 소프트 프롬프트 훅
  const { promptState, checkAndShow: checkGps, hide: hideGpsPrompt } = useGpsSoftPrompt()

  const handleMarkerTap = useCallback((station) => {
    setSheetStation(station)
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
            onClose={() => setSheetStation(null)}
            onNavigate={() => {
              setTaxiOpen(true)
              setSheetStation(null)
            }}
            onDetail={() => {
              useAppStore.getState().setOpenInfoTab(sheetStation.id)
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
          <JeongwangShuttleOverlay map={mapInstance} />
          <DriveRoutePolyline map={mapInstance} />
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
