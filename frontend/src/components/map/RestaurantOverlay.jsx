import { useEffect, useRef } from 'react'

/**
 * 교내 식당 두 곳에 작은 점 마커 + pill 뱃지를 표시한다.
 * 좌표는 추정값 — 실제와 다르면 RESTAURANTS 배열의 lat/lng만 수정.
 */
const RESTAURANTS = [
  { id: 'semicon',       label: '세미콘',        lat: 37.338807274486,   lng: 126.73261039158,    color: '#6366f1' },
  { id: 'miga',          label: '미가',          lat: 37.33927138967224, lng: 126.73224989005199, color: '#10b981' },
  { id: 'bus3400_term',  label: '3400 시종점',   lat: 37.342166,         lng: 126.735972,         color: '#f59e0b' },
]

function makePillEl(label, color) {
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:3px',
    'background:rgba(255,255,255,0.96)',
    'border-radius:99px',
    'padding:2px 8px 2px 5px',
    'font-size:11px',
    'font-weight:700',
    'color:#374151',
    'box-shadow:0 1px 4px rgba(0,0,0,0.2)',
    'white-space:nowrap',
    'pointer-events:none',
    'line-height:1.4',
  ].join(';')

  const dot = document.createElement('span')
  dot.style.cssText = [
    `width:7px`,
    `height:7px`,
    `border-radius:50%`,
    `background:${color}`,
    `display:inline-block`,
    `flex-shrink:0`,
  ].join(';')

  const text = document.createElement('span')
  text.textContent = label

  wrap.appendChild(dot)
  wrap.appendChild(text)
  return wrap
}

export default function RestaurantOverlay({ map }) {
  const overlaysRef = useRef([])

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    RESTAURANTS.forEach(({ lat, lng, label, color }) => {
      const pos = new window.kakao.maps.LatLng(lat, lng)

      // 작은 원형 점 마커
      const dotEl = document.createElement('div')
      dotEl.style.cssText = [
        `width:10px`,
        `height:10px`,
        `border-radius:50%`,
        `background:${color}`,
        `border:2px solid white`,
        `box-shadow:0 1px 3px rgba(0,0,0,0.3)`,
        `pointer-events:none`,
      ].join(';')

      const dotOverlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: dotEl,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 6,
      })
      dotOverlay.setMap(map)

      // pill 뱃지 (점 위 8px)
      const pillEl = makePillEl(label, color)
      const pillOverlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: pillEl,
        xAnchor: 0.5,
        yAnchor: 1.6,   // 점보다 위로
        zIndex: 7,
      })
      pillOverlay.setMap(map)

      overlaysRef.current.push(dotOverlay, pillOverlay)
    })

    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null))
      overlaysRef.current = []
    }
  }, [map])

  return null
}
