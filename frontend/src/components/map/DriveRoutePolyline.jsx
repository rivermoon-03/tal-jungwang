import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'

/**
 * Zustand driveRouteCoords([[lng,lat],...])를 읽어
 * 카카오맵에 파란 Polyline으로 경로를 그린다.
 * coords가 null이 되면 Polyline을 제거한다.
 */
export default function DriveRoutePolyline({ map }) {
  const polylineRef = useRef(null)
  const driveRouteCoords = useAppStore((s) => s.driveRouteCoords)

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    // 기존 폴리라인 제거
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (!driveRouteCoords?.length) return

    const path = driveRouteCoords.map(
      ([lng, lat]) => new window.kakao.maps.LatLng(lat, lng)
    )

    const polyline = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: '#1D4ED8',   // blue-700
      strokeOpacity: 0.85,
      strokeStyle: 'solid',
    })
    polyline.setMap(map)
    polylineRef.current = polyline

    // 경로가 보이도록 지도 범위 조정
    const bounds = new window.kakao.maps.LatLngBounds()
    path.forEach((latlng) => bounds.extend(latlng))
    map.setBounds(bounds, 60)

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
    }
  }, [map, driveRouteCoords])

  return null
}
