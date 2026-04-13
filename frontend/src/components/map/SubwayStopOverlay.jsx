import { useEffect, useRef } from 'react'
import { useSubwayTimetable } from '../../hooks/useSubway'

const JEONGWANG = { lat: 37.351618, lng: 126.742747 }
const MARKER_W = 22
const MARKER_H = 28

const LABEL_STYLE = [
  'background:rgba(255,255,255,0.95)',
  'border-radius:10px',
  'padding:4px 8px',
  'font-size:11px',
  'font-weight:700',
  'color:#1a237e',
  'box-shadow:0 1px 4px rgba(0,0,0,0.18)',
  'white-space:nowrap',
  'transform:translate(13px,-24px)',
  'pointer-events:none',
  'line-height:1.5',
].join(';')

function getNextMin(trains) {
  if (!trains?.length) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const next = trains.find((t) => {
    const [hh, mm] = t.depart_at.split(':').map(Number)
    return hh * 60 + mm > nowMin
  })
  if (!next) return null
  const [hh, mm] = next.depart_at.split(':').map(Number)
  const diffSec = hh * 3600 + mm * 60 - nowSec
  return diffSec > 0 ? Math.floor(diffSec / 60) : null
}

function fmt(min) {
  if (min == null) return '—'
  return min === 0 ? '곧 출발' : `${min}분`
}

export default function SubwayStopOverlay({ map }) {
  const markerRef = useRef(null)
  const labelDivRef = useRef(null)
  const labelOverlayRef = useRef(null)
  const { data: timetableData } = useSubwayTimetable()

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

  // 수인분당선·4호선 상행/하행 다음 열차 시간으로 레이블 업데이트
  useEffect(() => {
    const div = labelDivRef.current
    if (!div || !timetableData) return

    const sdUp   = getNextMin(timetableData.up)
    const sdDown = getNextMin(timetableData.down)
    const l4Up   = getNextMin(timetableData.line4_up)
    const l4Down = getNextMin(timetableData.line4_down)

    if ([sdUp, sdDown, l4Up, l4Down].every((v) => v == null)) {
      div.style.display = 'none'
      return
    }

    div.innerHTML = [
      `<span style="color:#d97706;font-weight:900">수</span>`,
      `<span style="color:#374151"> ↑${fmt(sdUp)} ↓${fmt(sdDown)}</span>`,
      `<span style="color:#1d4ed8;font-weight:900;margin-left:5px">4</span>`,
      `<span style="color:#374151"> ↑${fmt(l4Up)} ↓${fmt(l4Down)}</span>`,
    ].join('')
    div.style.display = 'block'
  }, [timetableData])

  return null
}
