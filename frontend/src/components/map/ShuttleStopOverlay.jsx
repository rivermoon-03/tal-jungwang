import { useEffect, useRef } from 'react'
import { useShuttleNext } from '../../hooks/useShuttle'

const SHUTTLE_STOP = { lat: 37.339343, lng: 126.73279 }
const MARKER_W = 22
const MARKER_H = 28

const LABEL_STYLE = [
  'background:rgba(255,255,255,0.95)',
  'border-radius:99px',
  'padding:2px 7px',
  'font-size:11px',
  'font-weight:700',
  'color:#1a237e',
  'box-shadow:0 1px 4px rgba(0,0,0,0.18)',
  'white-space:nowrap',
  'transform:translate(13px,-20px)',
  'pointer-events:none',
].join(';')

export default function ShuttleStopOverlay({ map }) {
  const markerRef = useRef(null)
  const labelDivRef = useRef(null)
  const labelOverlayRef = useRef(null)
  const { data: nextShuttle } = useShuttleNext()

  // 마커 + 레이블 오버레이 생성 (map 준비 후 1회)
  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const pos = new window.kakao.maps.LatLng(SHUTTLE_STOP.lat, SHUTTLE_STOP.lng)
    const markerImage = new window.kakao.maps.MarkerImage(
      '/icons/marker-shuttle.svg',
      new window.kakao.maps.Size(MARKER_W, MARKER_H),
      { offset: new window.kakao.maps.Point(MARKER_W / 2, MARKER_H) },
    )
    markerRef.current = new window.kakao.maps.Marker({ position: pos, image: markerImage })
    markerRef.current.setMap(map)

    const labelDiv = document.createElement('div')
    labelDiv.style.cssText = LABEL_STYLE
    labelDiv.style.display = 'none'
    labelDivRef.current = labelDiv

    labelOverlayRef.current = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: labelDiv,
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
      labelDivRef.current = null
    }
  }, [map])

  // 데이터 변경 시 레이블 텍스트 업데이트
  useEffect(() => {
    const div = labelDivRef.current
    if (!div) return
    const sec = nextShuttle?.arrive_in_seconds
    if (sec != null && sec > 0) {
      div.textContent = `${Math.floor(sec / 60)}분`
      div.style.display = 'block'
    } else {
      div.style.display = 'none'
    }
  }, [nextShuttle])

  return null
}
