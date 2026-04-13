import { useEffect, useRef } from 'react'
import { useBusArrivals } from '../../hooks/useBus'

const BUS_STOP = { lat: 37.341633, lng: 126.731252 }
const JEONGWANG_STATION_ID = '224000639'
const MARKER_W = 22
const MARKER_H = 28

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
  const { data: busData } = useBusArrivals(JEONGWANG_STATION_ID)

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
    labelDiv.style.display = 'none'
    labelDivRef.current = labelDiv

    const badgeDiv = document.createElement('div')
    badgeDiv.style.cssText = BADGE_STYLE
    badgeDiv.textContent = '테스트 중'

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

    const arrival = busData?.arrivals?.find(
      (a) => a.route_no === '33' && a.arrival_type === 'realtime',
    )
    const sec = arrival?.arrive_in_seconds
    if (sec != null && sec > 0) {
      div.textContent = `33번 - ${Math.round(sec / 60)}분`
      div.style.display = 'block'
    } else {
      div.style.display = 'none'
    }
  }, [busData])

  return null
}
