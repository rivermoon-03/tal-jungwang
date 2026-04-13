import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useShuttleNext } from '../../hooks/useShuttle'

const JEONGWANG_SHUTTLE = { lat: 37.351134, lng: 126.742043 }
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

export default function JeongwangShuttleOverlay({ map }) {
  const markerRef = useRef(null)
  const labelDivRef = useRef(null)
  const labelOverlayRef = useRef(null)
  const setSelectedStationId = useAppStore((s) => s.setSelectedStationId)

  // 등교 방향 다음 셔틀 (회차편 여부 확인용)
  const { data: nextShuttle } = useShuttleNext('등교')

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const pos = new window.kakao.maps.LatLng(JEONGWANG_SHUTTLE.lat, JEONGWANG_SHUTTLE.lng)
    const imgSize = new window.kakao.maps.Size(MARKER_W, MARKER_H)
    const imgOption = { offset: new window.kakao.maps.Point(MARKER_W / 2, MARKER_H) }
    const markerImage = new window.kakao.maps.MarkerImage('/icons/marker-shuttle.svg', imgSize, imgOption)
    const marker = new window.kakao.maps.Marker({ position: pos, image: markerImage })
    marker.setMap(map)
    markerRef.current = marker

    window.kakao.maps.event.addListener(marker, 'click', () => {
      setSelectedStationId('jeongwang_shuttle')
    })

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
  }, [map, setSelectedStationId])

  useEffect(() => {
    const div = labelDivRef.current
    if (!div) return

    const sec = nextShuttle?.arrive_in_seconds
    const note = nextShuttle?.note ?? ''

    if (sec != null && sec > 0) {
      if (note.includes('회차편')) {
        // 회차편 탑승 가능 시간대
        div.textContent = '회차 버스 탑승'
        div.style.color = '#b45309'  // amber-700
        div.style.background = 'rgba(254,243,199,0.97)'  // amber-100
      } else {
        div.textContent = `${Math.floor(sec / 60)}분`
        div.style.color = '#1a237e'
        div.style.background = 'rgba(255,255,255,0.95)'
      }
      div.style.display = 'block'
    } else {
      div.textContent = '💤'
      div.style.color = '#94a3b8'
      div.style.background = 'rgba(255,255,255,0.85)'
      div.style.display = 'block'
    }
  }, [nextShuttle])

  return null
}
