import { useEffect, useRef, useState } from 'react'

// PC 정류장 picker용 미니 카카오맵.
// SDK는 MapView가 로드하므로 여기서는 window.kakao.maps 가 준비될 때까지 기다리기만 한다.
// drag / zoom / scroll 등 인터랙션은 비활성화 (장식용 미니 미리보기).
//
// Props:
//  - center: { lat, lng }
//  - userPos: { lat, lng } | null  (파란 펄스 핀)
//  - stationPos: { lat, lng } | null  (검정 stop 핀)
//  - level: 카카오 줌 레벨 (낮을수록 가까움. 기본 4)

export default function MiniKakaoMap({ center, userPos, stationPos, level = 4 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const userOverlayRef = useRef(null)
  const stationOverlayRef = useRef(null)
  const [ready, setReady] = useState(() => Boolean(window.kakao?.maps?.LatLng))

  // SDK ready 폴링 (MapView가 로드 중일 때 대기)
  useEffect(() => {
    if (ready) return
    let id = null
    function tick() {
      if (window.kakao?.maps?.LatLng) {
        setReady(true)
        return
      }
      id = setTimeout(tick, 200)
    }
    tick()
    return () => { if (id) clearTimeout(id) }
  }, [ready])

  // 지도 인스턴스 생성
  useEffect(() => {
    if (!ready) return
    if (!containerRef.current) return
    if (mapRef.current) return

    const { kakao } = window
    const c = new kakao.maps.LatLng(center.lat, center.lng)
    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: c,
      level,
      draggable: false,
      scrollwheel: false,
      disableDoubleClick: true,
      disableDoubleClickZoom: true,
      keyboardShortcuts: false,
    })
    // touch + pan 차단 (혹시 모를 인터랙션)
    mapRef.current.setZoomable(false)
  }, [ready, center.lat, center.lng, level])

  // 센터 / 레벨 갱신
  useEffect(() => {
    if (!mapRef.current) return
    const { kakao } = window
    if (!kakao) return
    mapRef.current.setLevel(level)
    mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng))
  }, [center.lat, center.lng, level])

  // 사용자 위치 오버레이 (파란 펄스)
  useEffect(() => {
    if (!mapRef.current) return
    const { kakao } = window
    if (!kakao) return
    if (userOverlayRef.current) {
      userOverlayRef.current.setMap(null)
      userOverlayRef.current = null
    }
    if (!userPos) return

    const el = document.createElement('div')
    el.style.cssText = [
      'width:14px', 'height:14px',
      'background:#4f9fff',
      'border:3px solid #fff',
      'border-radius:50%',
      'box-shadow:0 0 0 6px rgba(79,159,255,0.25), 0 2px 6px rgba(0,0,0,0.2)',
      'animation: userPulse 2.5s ease-out infinite',
      'pointer-events:none',
    ].join(';')
    userOverlayRef.current = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(userPos.lat, userPos.lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 5,
    })
    userOverlayRef.current.setMap(mapRef.current)
  }, [userPos?.lat, userPos?.lng])

  // 정류장 핀 오버레이 (검정 teardrop)
  useEffect(() => {
    if (!mapRef.current) return
    const { kakao } = window
    if (!kakao) return
    if (stationOverlayRef.current) {
      stationOverlayRef.current.setMap(null)
      stationOverlayRef.current = null
    }
    if (!stationPos) return

    const el = document.createElement('div')
    el.style.cssText = [
      'width:22px', 'height:22px',
      'background:#0b0d10',
      'border:3px solid #fff',
      'border-radius:50% 50% 50% 0',
      'transform:rotate(-45deg)',
      'transform-origin:center',
      'box-shadow:0 3px 8px rgba(0,0,0,0.3)',
      'pointer-events:none',
    ].join(';')
    stationOverlayRef.current = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(stationPos.lat, stationPos.lng),
      content: el,
      // teardrop의 점이 정확히 좌표를 가리키도록
      yAnchor: 1.0,
      xAnchor: 0.5,
      zIndex: 4,
    })
    stationOverlayRef.current.setMap(mapRef.current)
  }, [stationPos?.lat, stationPos?.lng])

  // 정리
  useEffect(() => {
    return () => {
      if (userOverlayRef.current) userOverlayRef.current.setMap(null)
      if (stationOverlayRef.current) stationOverlayRef.current.setMap(null)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#e6ebf2' }}
      aria-hidden="true"
    />
  )
}
