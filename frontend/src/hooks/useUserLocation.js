import { useEffect, useState } from 'react'

// 주요 버스 정류장 WGS84 좌표. CLAUDE.md 에 있는 학교 좌표 + 현장 대표 지점.
export const STATION_COORDS = {
  '한국공학대': [37.340012, 126.733548],
  '이마트':     [37.345100, 126.738200],
  '시화터미널': [37.331800, 126.727900],
  '시흥시청':   [37.381656, 126.805878],
  '서울':       [37.566500, 126.978000],
}

function distanceMeters([lat1, lng1], [lat2, lng2]) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function getNearestStation(lat, lng, allowed = null) {
  const info = getNearestStationInfo(lat, lng, allowed)
  return info ? info.name : null
}

// 가장 가까운 정류장 + 거리(meters) 반환. PCStationPicker 등 거리 표시용.
export function getNearestStationInfo(lat, lng, allowed = null) {
  const candidates = Object.entries(STATION_COORDS).filter(
    ([name]) => !allowed || allowed.includes(name),
  )
  let best = null
  let bestD = Infinity
  for (const [name, coord] of candidates) {
    const d = distanceMeters([lat, lng], coord)
    if (d < bestD) {
      bestD = d
      best = name
    }
  }
  return best ? { name: best, distanceM: Math.round(bestD) } : null
}

/**
 * @param {boolean} [enabled=true] false면 geolocation을 요청하지 않는다.
 *   지도 확장 진입 시에만 위치를 묻고 싶은 호출부(MapView)가 이 값을
 *   `mapExpanded`에 연결해 평소(축소 상태)엔 GPS를 조용히 두게 한다
 *   (mistakes.md §3 — 숨겨진/비활성 화면에서 GPS가 백그라운드로 도는 것 방지).
 *   false→true로 바뀌면 그 시점에 다시 한 번 요청한다.
 */
export default function useUserLocation(enabled = true) {
  const [coords, setCoords] = useState(null)
  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords([p.coords.latitude, p.coords.longitude]),
      () => setCoords(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    )
  }, [enabled])
  return coords
}
