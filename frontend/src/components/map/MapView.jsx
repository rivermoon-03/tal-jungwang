import { useEffect, useRef, useState } from 'react'
import { Locate, School } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import UserLocationMarker from './UserLocationMarker'
import ShuttleStopOverlay from './ShuttleStopOverlay'
import SubwayStopOverlay from './SubwayStopOverlay'
import JeongwangShuttleOverlay from './JeongwangShuttleOverlay'
import Siheung33BusOverlay from './Siheung33BusOverlay'

// 한국공학대학교 정문 좌표
const DEFAULT_CENTER = { lat: 37.3400, lng: 126.7335 }
const SDK_SCRIPT_ID = 'kakao-map-sdk'

export default function MapView({ onMarkerClick, selectedId, InfoPanelSlot }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [sdkReady, setSdkReady] = useState(() => Boolean(window.kakao?.maps?.LatLng))
  // map 인스턴스가 준비됐을 때 자식 오버레이 컴포넌트를 렌더링하기 위한 상태
  const [mapInstance, setMapInstance] = useState(null)
  const kakaoKey = import.meta.env.VITE_KAKAO_JS_APP_KEY
  const userLocation = useAppStore((s) => s.userLocation)

  function panTo(lat, lng) {
    if (!mapRef.current) return
    mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng))
  }

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

    // 실시간 교통정보 레이어 (마유로 등 도로 혼잡도 색상 오버레이)
    map.addOverlayMapTypeId(window.kakao.maps.MapTypeId.TRAFFIC)

    // 자식 오버레이 컴포넌트에 map 인스턴스 전달
    setMapInstance(map)

    return () => {
      mapRef.current = null
      setMapInstance(null)
    }
  }, [sdkReady])

  if (!kakaoKey) {
    return (
      <div className="flex-1 relative bg-slate-200 overflow-hidden select-none">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-slate-400 text-base font-medium">카카오맵 (API 키 설정 후 활성화)</p>
        </div>
      </div>
    )
  }

  if (!sdkReady) {
    return (
      <div className="flex-1 relative bg-slate-200 overflow-hidden select-none">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-slate-400 text-base font-medium">지도를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="flex-1 bg-slate-200 relative" style={{ minHeight: 300 }}>
        {mapInstance && InfoPanelSlot}

        {/* 우상단 지도 이동 버튼 */}
        {mapInstance && (
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 pointer-events-auto">
            {userLocation && (
              <button
                aria-label="내 위치로 이동"
                onClick={() => panTo(userLocation.lat, userLocation.lng)}
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center text-navy pressable"
              >
                <Locate size={18} strokeWidth={2} />
              </button>
            )}
            <button
              aria-label="학교로 이동"
              onClick={() => panTo(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng)}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center text-navy pressable"
            >
              <School size={18} strokeWidth={2} />
            </button>
          </div>
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
        </>
      )}
    </>
  )
}
