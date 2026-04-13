import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'

/**
 * 사용자 GPS 위치를 지도에 파란 원형 오버레이로 표시.
 * navigator.geolocation.watchPosition 으로 실시간 추적.
 * 위치 변경 시 useAppStore.setUserLocation 업데이트.
 */
export default function UserLocationMarker({ map }) {
  const overlayRef = useRef(null)
  const watchIdRef = useRef(null)
  const setUserLocation = useAppStore((s) => s.setUserLocation)

  useEffect(() => {
    if (!map || !window.kakao?.maps || !navigator.geolocation) return

    function placeOverlay(lat, lng) {
      const pos = new window.kakao.maps.LatLng(lat, lng)
      if (overlayRef.current) {
        overlayRef.current.setPosition(pos)
        return
      }

      // 파란 원 + 흰 테두리 + 외곽 반투명 링
      const div = document.createElement('div')
      div.style.cssText = [
        'display:inline-block',
        'width:16px', 'height:16px', 'border-radius:50%',
        'background:#2563EB', 'border:2.5px solid white',
        'box-shadow:0 0 0 4px rgba(37,99,235,0.25)',
        'cursor:default',
      ].join(';')

      overlayRef.current = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: div,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 10,
      })
      overlayRef.current.setMap(map)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude })
        placeOverlay(coords.latitude, coords.longitude)
      },
      () => { /* GPS 비활성 또는 타임아웃 — 위치 없음 처리, 무시 */ },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
        overlayRef.current = null
      }
    }
  }, [map, setUserLocation])

  return null
}
