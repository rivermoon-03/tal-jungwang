import { useEffect, useRef } from 'react'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import useAppStore from '../../stores/useAppStore'

/**
 * 3400번 버스 시종점 위치에 점 마커 + pill 뱃지를 표시한다.
 * timetable 데이터가 바뀌면 뱃지 레이블이 다음 출발 시간으로 갱신된다.
 */
const TERMINUS = {
  id: 'bus3400_term',
  label: '3400 시종점',
  lat: 37.342166,
  lng: 126.735972,
  color: '#f59e0b',
}

function getNextDeparture(times = []) {
  if (!times.length) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return (
    times.find((t) => {
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + mm > nowMin
    }) ?? null
  )
}

function makePillEl(label, color, darkMode) {
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:3px',
    `background:${darkMode ? 'rgba(30,41,59,0.96)' : 'rgba(255,255,255,0.96)'}`,
    'border-radius:99px',
    'padding:2px 8px 2px 5px',
    'font-size:11px',
    'font-weight:700',
    `color:${darkMode ? '#cbd5e1' : '#374151'}`,
    'box-shadow:0 1px 4px rgba(0,0,0,0.2)',
    'white-space:nowrap',
    'pointer-events:none',
    'line-height:1.4',
  ].join(';')

  const dot = document.createElement('span')
  dot.style.cssText = [
    'width:7px',
    'height:7px',
    'border-radius:50%',
    `background:${color}`,
    'display:inline-block',
    'flex-shrink:0',
  ].join(';')

  const text = document.createElement('span')
  text.textContent = label

  wrap.appendChild(dot)
  wrap.appendChild(text)
  return wrap
}

export default function RestaurantOverlay({ map }) {
  const overlaysRef = useRef([])
  const { data: timetable3400 } = useBusTimetableByRoute('3400')
  const darkMode = useAppStore((s) => s.darkMode)

  const nextDeparture = getNextDeparture(timetable3400?.times)

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    // 기존 오버레이 제거
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []

    const { lat, lng, label, color } = TERMINUS
    const pos = new window.kakao.maps.LatLng(lat, lng)

    // 작은 원형 점 마커
    const dotEl = document.createElement('div')
    dotEl.style.cssText = [
      'width:10px',
      'height:10px',
      'border-radius:50%',
      `background:${color}`,
      'border:2px solid white',
      'box-shadow:0 1px 3px rgba(0,0,0,0.3)',
      'pointer-events:none',
    ].join(';')

    const dotOverlay = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: dotEl,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 6,
    })
    dotOverlay.setMap(map)

    // pill 뱃지 — 다음 출발 시간 포함
    const pillLabel = nextDeparture
      ? `${label} · ${nextDeparture}`
      : `${label} · 금일 종료`

    const pillEl = makePillEl(pillLabel, color, darkMode)
    const pillOverlay = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: pillEl,
      xAnchor: 0.5,
      yAnchor: 1.6,
      zIndex: 7,
    })
    pillOverlay.setMap(map)

    overlaysRef.current.push(dotOverlay, pillOverlay)

    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null))
      overlaysRef.current = []
    }
  }, [map, nextDeparture, darkMode])

  return null
}
