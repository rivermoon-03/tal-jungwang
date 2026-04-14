import { useEffect, useRef } from 'react'
import { useSubwayTimetable } from '../../hooks/useSubway'
import useAppStore from '../../stores/useAppStore'

const STATIONS = [
  {
    id: 'choji',
    lat: 37.319819,
    lng: 126.80775,
    tabId: 'choji',
    upKey: 'choji_up',
    dnKey: 'choji_dn',
  },
  {
    id: 'siheung',
    lat: 37.381656,
    lng: 126.805878,
    tabId: 'siheung',
    upKey: 'siheung_up',
    dnKey: 'siheung_dn',
  },
]

const MARKER_W = 22
const MARKER_H = 28

const LABEL_STYLE = [
  'border-radius:10px',
  'padding:4px 8px',
  'font-size:11px',
  'font-weight:700',
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

export default function SeohaeStopOverlay({ map }) {
  const markersRef = useRef([])   // [{ markerRef, labelDivRef, labelOverlayRef }]
  const { data: timetableData } = useSubwayTimetable()
  const darkMode = useAppStore((s) => s.darkMode)

  // 마커 + 레이블 오버레이 생성 (map 준비 후 1회)
  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const instances = STATIONS.map((station) => {
      const pos = new window.kakao.maps.LatLng(station.lat, station.lng)
      const markerImage = new window.kakao.maps.MarkerImage(
        '/icons/marker-subway.svg',
        new window.kakao.maps.Size(MARKER_W, MARKER_H),
        { offset: new window.kakao.maps.Point(MARKER_W / 2, MARKER_H) },
      )
      const marker = new window.kakao.maps.Marker({ position: pos, image: markerImage })
      marker.setMap(map)
      window.kakao.maps.event.addListener(marker, 'click', () => {
        useAppStore.getState().setOpenInfoTab(station.tabId)
      })

      const labelDiv = document.createElement('div')
      labelDiv.style.cssText = LABEL_STYLE
      labelDiv.style.display = 'none'

      const labelOverlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: labelDiv,
        xAnchor: 0,
        yAnchor: 0,
        zIndex: 5,
      })
      labelOverlay.setMap(map)

      return { marker, labelDiv, labelOverlay }
    })

    markersRef.current = instances

    return () => {
      instances.forEach(({ marker, labelOverlay }) => {
        marker.setMap(null)
        labelOverlay.setMap(null)
      })
      markersRef.current = []
    }
  }, [map])

  // 시간표 데이터 / 다크모드 변경 시 레이블 업데이트
  useEffect(() => {
    if (!timetableData || markersRef.current.length === 0) return

    const textColor = darkMode ? '#cbd5e1' : '#374151'
    const bg = darkMode ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)'

    STATIONS.forEach((station, i) => {
      const { labelDiv } = markersRef.current[i]
      if (!labelDiv) return

      const up = getNextMin(timetableData[station.upKey])
      const dn = getNextMin(timetableData[station.dnKey])

      if (up == null && dn == null) {
        labelDiv.style.display = 'none'
        return
      }

      labelDiv.style.background = bg
      labelDiv.innerHTML = [
        `<span style="color:#75bf43;font-weight:900">서</span>`,
        `<span style="color:${textColor}"> ↑${fmt(up)} ↓${fmt(dn)}</span>`,
      ].join('')
      labelDiv.style.display = 'block'
    })
  }, [timetableData, darkMode])

  return null
}
