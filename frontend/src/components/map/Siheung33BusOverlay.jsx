import { useEffect, useRef } from 'react'
import { useBusArrivals, useBusStations } from '../../hooks/useBus'

const BUS_STOP = { lat: 37.341633, lng: 126.731252 }
const STATION_NAME = '한국공학대학교'
const MARKER_W = 22
const MARKER_H = 28

function isRoute33(route_no) {
  return route_no === '33' || route_no === '시흥33'
}

// 라벨 + 테스트 중 뱃지를 담는 컨테이너 스타일
const CONTAINER_STYLE = [
  'display:flex',
  'flex-direction:column',
  'align-items:flex-start',
  'gap:2px',
  'transform:translate(13px,-24px)',
  'pointer-events:none',
].join(';')

const LABEL_STYLE = [
  'background:rgba(255,255,255,0.95)',
  'border-radius:99px',
  'padding:2px 7px',
  'font-size:11px',
  'font-weight:700',
  'color:#9a3412',
  'box-shadow:0 1px 4px rgba(0,0,0,0.18)',
  'white-space:nowrap',
].join(';')

const BADGE_STYLE = [
  'background:#fef9c3',
  'border:1px solid #fbbf24',
  'border-radius:99px',
  'padding:1px 5px',
  'font-size:9px',
  'font-weight:700',
  'color:#92400e',
  'white-space:nowrap',
].join(';')

export default function Siheung33BusOverlay({ map }) {
  const markerRef = useRef(null)
  const containerDivRef = useRef(null)
  const labelDivRef = useRef(null)
  const labelOverlayRef = useRef(null)

  // 정류장 목록에서 한국공학대학교의 DB station_id를 동적으로 가져옴
  const { data: stations } = useBusStations()
  const stationId = stations?.find((s) => s.name === STATION_NAME)?.station_id ?? null
  const { data: busData } = useBusArrivals(stationId)

  // 마커 + 라벨 오버레이 생성 (map 준비 후 1회)
  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const pos = new window.kakao.maps.LatLng(BUS_STOP.lat, BUS_STOP.lng)
    const markerImage = new window.kakao.maps.MarkerImage(
      '/icons/marker-bus.svg',
      new window.kakao.maps.Size(MARKER_W, MARKER_H),
      { offset: new window.kakao.maps.Point(MARKER_W / 2, MARKER_H) },
    )
    markerRef.current = new window.kakao.maps.Marker({ position: pos, image: markerImage })
    markerRef.current.setMap(map)

    // 컨테이너 div (라벨 + 뱃지)
    const containerDiv = document.createElement('div')
    containerDiv.style.cssText = CONTAINER_STYLE
    containerDivRef.current = containerDiv

    const labelDiv = document.createElement('div')
    labelDiv.style.cssText = LABEL_STYLE
    labelDiv.textContent = '33번 - —'
    labelDivRef.current = labelDiv

    const badgeDiv = document.createElement('div')
    badgeDiv.style.cssText = BADGE_STYLE
    badgeDiv.textContent = '±2분 | 테스트 중'

    containerDiv.appendChild(badgeDiv)
    containerDiv.appendChild(labelDiv)

    labelOverlayRef.current = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: containerDiv,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 5,
    })
    labelOverlayRef.current.setMap(map)

    return () => {
      markerRef.current?.setMap(null)
      markerRef.current = null
      labelOverlayRef.current?.setMap(null)
      labelOverlayRef.current = null
      containerDivRef.current = null
      labelDivRef.current = null
    }
  }, [map])

  // 버스 도착 데이터 변경 시 라벨 업데이트
  useEffect(() => {
    const div = labelDivRef.current
    if (!div) return

    // 실시간 우선, 없으면 시간표 기반으로 fallback
    const realtime = busData?.arrivals?.find(
      (a) => isRoute33(a.route_no) && a.arrival_type === 'realtime' && (a.arrive_in_seconds ?? 0) > 0,
    )
    const timetable = busData?.arrivals?.find(
      (a) => isRoute33(a.route_no) && a.arrival_type === 'timetable',
    )

    if (realtime) {
      div.textContent = `33번 - ${Math.round(realtime.arrive_in_seconds / 60)}분`
    } else if (timetable?.depart_at) {
      const [hh, mm] = timetable.depart_at.split(':').map(Number)
      const now = new Date()
      const diffSec = (hh * 3600 + mm * 60) - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
      div.textContent = diffSec > 0 ? `33번 - ${Math.round(diffSec / 60)}분` : '33번 - —'
    } else {
      div.textContent = '33번 - —'
    }
    div.style.display = 'block'
  }, [busData])

  return null
}
