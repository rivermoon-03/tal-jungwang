import { useEffect, useRef, useState } from 'react'
import { Car } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import UserLocationMarker from './UserLocationMarker'
import ShuttleStopOverlay from './ShuttleStopOverlay'
import SubwayStopOverlay from './SubwayStopOverlay'
import JeongwangShuttleOverlay from './JeongwangShuttleOverlay'
import Siheung33BusOverlay from './Siheung33BusOverlay'
import TaxiCard from './TaxiCard'
import DriveRoutePolyline from './DriveRoutePolyline'
import RestaurantOverlay from './RestaurantOverlay'

// 한국공학대학교 정문 좌표
const DEFAULT_CENTER = { lat: 37.3400, lng: 126.7335 }
const SDK_SCRIPT_ID = 'kakao-map-sdk'


export default function MapView({ onMarkerClick, selectedId, InfoPanelSlot }) {
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

  function panTo(lat, lng) {
    if (!mapRef.current) return
    mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng))
  }

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

    // 실시간 교통정보 레이어
    map.addOverlayMapTypeId(window.kakao.maps.MapTypeId.TRAFFIC)

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
        │  │  InfoPanelSlot, 버튼, TaxiCard                        │  │
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

        {/* React UI 오버레이 — 필터 영향 없음 */}
        {mapInstance && InfoPanelSlot}

        {/* 우상단 지도 이동 버튼 + 다크모드 토글 */}

        {/* 택시 카드 */}
        {mapInstance && (
          <TaxiCard
            open={taxiOpen}
            onClose={() => {
              setTaxiOpen(false)
              setDriveRouteCoords(null)
            }}
          />
        )}
      </div>

      {/* map 인스턴스가 준비된 후 오버레이 컴포넌트 마운트 */}
      {mapInstance && (
        <>
          <UserLocationMarker map={mapInstance} />
          <ShuttleStopOverlay map={mapInstance} />
          <SubwayStopOverlay map={mapInstance} />
          <JeongwangShuttleOverlay map={mapInstance} />
          <Siheung33BusOverlay map={mapInstance} />
          <DriveRoutePolyline map={mapInstance} />
          <RestaurantOverlay map={mapInstance} />
        </>
      )}
    </>
  )
}
