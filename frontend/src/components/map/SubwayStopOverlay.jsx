import { useEffect, useRef } from 'react'
import { useSubwayNext } from '../../hooks/useSubway'

const JEONGWANG = { lat: 37.351618, lng: 126.742747 }
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

export default function SubwayStopOverlay({ map }) {
  const markerRef = useRef(null)
  const labelDivRef = useRef(null)
  const labelOverlayRef = useRef(null)
  const { data: subwayData } = useSubwayNext()

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const pos = new window.kakao.maps.LatLng(JEONGWANG.lat, JEONGWANG.lng)
    const markerImage = new window.kakao.maps.MarkerImage(
      '/icons/marker-subway.svg',
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

  // 가장 빠른 지하철 도착 시간으로 레이블 업데이트
  useEffect(() => {
    const div = labelDivRef.current
    if (!div) return

    const candidates = [
      subwayData?.up?.arrive_in_seconds,
      subwayData?.down?.arrive_in_seconds,
      subwayData?.line4_up?.arrive_in_seconds,
      subwayData?.line4_down?.arrive_in_seconds,
    ].filter((v) => v != null)

    if (candidates.length) {
      const minSec = Math.min(...candidates)
      div.textContent = `${Math.floor(minSec / 60)}분`
      div.style.display = 'block'
    } else {
      div.style.display = 'none'
    }
  }, [subwayData])

  return null
}
