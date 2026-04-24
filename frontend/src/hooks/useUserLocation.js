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
  return best
}

export default function useUserLocation() {
  const [coords, setCoords] = useState(null)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords([p.coords.latitude, p.coords.longitude]),
      () => setCoords(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    )
  }, [])
  return coords
}
