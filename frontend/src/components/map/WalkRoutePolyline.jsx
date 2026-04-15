import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'

/**
 * walkRoute.coords([[lng,lat],...])를 카카오맵 Polyline(초록, 점선)으로 렌더.
 * coords 가 비면 폴리라인 제거.
 */
export default function WalkRoutePolyline({ map }) {
  const polylineRef = useRef(null)
  const walkRoute = useAppStore((s) => s.walkRoute)

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    const coords = walkRoute?.coords
    if (!coords?.length) return

    const path = coords.map(([lng, lat]) => new window.kakao.maps.LatLng(lat, lng))

    const polyline = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: '#16A34A',   // green-600
      strokeOpacity: 0.9,
      strokeStyle: 'dashed',
    })
    polyline.setMap(map)
    polylineRef.current = polyline

    const bounds = new window.kakao.maps.LatLngBounds()
    path.forEach((latlng) => bounds.extend(latlng))
    map.setBounds(bounds, 80)

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
    }
  }, [map, walkRoute])

  return null
}
