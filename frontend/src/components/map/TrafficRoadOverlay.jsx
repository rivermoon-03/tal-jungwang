import { useEffect, useRef } from 'react'
import { useApi } from '../../hooks/useApi'

/**
 * 백엔드 /api/v1/traffic 데이터를 지도 위 도로별 원형 오버레이로 시각화한다.
 * - 테두리 색상: 초록(원활) → 노랑(서행) → 주황(지체) → 빨강(정체)
 * - 클릭 시 도로명 · 혼잡도 · 평균속도 · 기준시각 툴팁 표시
 */

// 도로별 지도 좌표 (좌표 미확인 도로는 비활성화)
const ROAD_POSITIONS = {
  '마유로':    { lat: 37.343398, lng: 126.732849 },
  // '옥구공원로': { lat: 37.343506, lng: 126.733809 },  // TMAP 미반환 — 도로명 확인 필요
  // '산기대학로': { lat: 37.3400, lng: 126.7320 },   // 좌표 미확인
  // '희망공원로': { lat: 37.3428, lng: 126.7338 },   // 좌표 미확인
  // '공단1대로':  { lat: 37.3468, lng: 126.7355 },   // 좌표 미확인
  // '군자천로':   { lat: 37.3483, lng: 126.7418 },   // 좌표 미확인
}

// 혼잡도 레벨 → 테두리 색상
const CONGESTION_COLOR = {
  1: '#22c55e', // 원활
  2: '#eab308', // 서행
  3: '#f97316', // 지체
  4: '#ef4444', // 정체
}

// 혼잡도 레벨 → 원 안 표시 텍스트 (3단계)
const CONGESTION_LABEL = {
  1: '여유',
  2: '혼잡',
  3: '혼잡',
  4: '정체',
}

const CIRCLE_PX = 40

/** 오버레이 DOM 구조 생성. 반환값을 ref에 저장해 업데이트에 재사용한다. */
function createOverlayDOM() {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative;display:inline-block;cursor:pointer'

  const tooltip = document.createElement('div')
  tooltip.style.cssText = [
    'display:none',
    'position:absolute',
    `bottom:${CIRCLE_PX + 8}px`,
    'left:50%',
    'transform:translateX(-50%)',
    'background:#fff',
    'border-radius:8px',
    'padding:7px 11px',
    'box-shadow:0 4px 14px rgba(0,0,0,0.22)',
    'white-space:nowrap',
    'min-width:118px',
    'cursor:pointer',
    'z-index:10',
  ].join(';')

  const circle = document.createElement('div')
  circle.style.cssText = [
    `width:${CIRCLE_PX}px`,
    `height:${CIRCLE_PX}px`,
    'border-radius:50%',
    'background:#fff',
    'border:3px solid #cbd5e1',
    'box-shadow:0 2px 6px rgba(0,0,0,0.22)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';')

  const label = document.createElement('span')
  label.style.cssText = 'font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:-0.5px'
  circle.appendChild(label)

  wrapper.appendChild(tooltip)
  wrapper.appendChild(circle)

  return { wrapper, tooltip, circle, label }
}

/** 툴팁 HTML 내용을 갱신한다. */
function updateTooltip(tooltip, roadName, road, updatedAt) {
  const color = CONGESTION_COLOR[road.congestion] ?? '#94a3b8'
  tooltip.innerHTML = `
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:3px">${roadName}</div>
    <div style="font-size:12px;font-weight:600;color:${color};margin-bottom:2px">
      ${road.congestion_label} · ${road.speed}km/h
    </div>
    <div style="font-size:11px;color:#94a3b8">${updatedAt} 기준</div>
    <div style="
      position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
      width:10px;height:5px;background:#fff;
      clip-path:polygon(0 0,100% 0,50% 100%)
    "></div>
  `
}

export default function TrafficRoadOverlay({ map }) {
  // roadName → { overlay, tooltip, circle }
  const itemsRef = useRef({})
  const { data } = useApi('/traffic', { interval: 90_000 })

  // 오버레이 생성 (map 준비 후 1회)
  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const items = {}

    Object.entries(ROAD_POSITIONS).forEach(([roadName, pos]) => {
      const { wrapper, tooltip, circle, label } = createOverlayDOM()

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(pos.lat, pos.lng),
        content: wrapper,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 4,
      })
      overlay.setMap(map)

      tooltip.addEventListener('click', (e) => {
        e.stopPropagation()
        tooltip.style.display = 'none'
      })

      wrapper.addEventListener('click', (e) => {
        e.stopPropagation()
        const alreadyOpen = tooltip.style.display !== 'none'
        // 다른 툴팁 닫기
        Object.values(items).forEach(item => { item.tooltip.style.display = 'none' })
        if (!alreadyOpen) tooltip.style.display = 'block'
      })

      items[roadName] = { overlay, tooltip, circle, label }
    })

    itemsRef.current = items

    // 지도 클릭 시 모든 툴팁 닫기
    function closeAll() {
      Object.values(items).forEach(item => { item.tooltip.style.display = 'none' })
    }
    window.kakao.maps.event.addListener(map, 'click', closeAll)

    return () => {
      Object.values(items).forEach(({ overlay }) => overlay.setMap(null))
      itemsRef.current = {}
      window.kakao.maps.event.removeListener(map, 'click', closeAll)
    }
  }, [map])

  // 데이터 변경 시 원 색상 + 툴팁 내용 갱신
  useEffect(() => {
    if (!data?.roads) return

    // 도로명별 최악 혼잡도 entry 추출
    const byRoad = {}
    data.roads.forEach(road => {
      const prev = byRoad[road.road_name]
      if (!prev || road.congestion > prev.congestion) {
        byRoad[road.road_name] = road
      }
    })

    const updatedAt = data.updated_at
      ? new Date(data.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '—'

    Object.entries(byRoad).forEach(([roadName, road]) => {
      const item = itemsRef.current[roadName]
      if (!item) return

      const color = CONGESTION_COLOR[road.congestion] ?? '#94a3b8'
      item.circle.style.borderColor = color
      item.label.textContent = CONGESTION_LABEL[road.congestion] ?? ''
      item.label.style.color = color
      updateTooltip(item.tooltip, roadName, road, updatedAt)
    })
  }, [data])

  return null
}
