import { useEffect, useRef } from 'react'
import { useApi } from '../../hooks/useApi'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * 백엔드 /api/v1/traffic 데이터를 지도 위 도로별 원형 오버레이로 시각화한다.
 * - 테두리 색상: 양방향 중 더 나쁜 혼잡도 기준
 * - 클릭 시 도로명 + 등교/하교방향 현재 속도 툴팁 표시
 */

// 도로별 지도 좌표 (좌표 미확인 도로는 비활성화)
const ROAD_POSITIONS = {
  '마유로':    { lat: 37.343398, lng: 126.732849 },
}

// 혼잡도 레벨 → 테두리 색상
const CONGESTION_COLOR = {
  1: '#22c55e', // 원활
  2: '#eab308', // 서행
  3: '#f97316', // 지체
  4: '#ef4444', // 정체
}

// 혼잡도 레벨 → 원 안 표시 텍스트
const CONGESTION_LABEL = {
  1: '여유',
  2: '혼잡',
  3: '혼잡',
  4: '정체',
}

// direction 코드 → 한글 라벨
const DIRECTION_LABEL = {
  to_school: '등교방향',
  to_station: '하교방향',
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
    'padding:8px 12px',
    'box-shadow:0 4px 14px rgba(0,0,0,0.22)',
    'white-space:nowrap',
    'min-width:150px',
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

/** 방향별 한 줄 HTML. road가 없으면 '—' 표시. */
function directionRow(directionCode, road) {
  const name = DIRECTION_LABEL[directionCode] ?? directionCode
  if (!road) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;margin-top:3px">
        <span style="color:#64748b">${esc(name)}</span>
        <span style="color:#cbd5e1">—</span>
      </div>`
  }
  const color = CONGESTION_COLOR[road.congestion] ?? '#94a3b8'
  return `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;margin-top:3px">
      <span style="color:#64748b">${esc(name)}</span>
      <span style="font-weight:600;color:${esc(color)}">${esc(road.speed)}km/h · ${esc(road.congestion_label)}</span>
    </div>`
}

/** 툴팁 HTML 전체를 갱신한다. */
function renderTooltip(tooltip, roadName, entry) {
  tooltip.innerHTML = `
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:4px">${esc(roadName)}</div>
    ${directionRow('to_school', entry.to_school)}
    ${directionRow('to_station', entry.to_station)}
    <div style="font-size:11px;color:#94a3b8;margin-top:6px">${esc(entry.updatedAt)} 기준</div>
    <div style="
      position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
      width:10px;height:5px;background:#fff;
      clip-path:polygon(0 0,100% 0,50% 100%)
    "></div>
  `
}

export default function TrafficRoadOverlay({ map }) {
  // roadName → { overlay, tooltip, circle, label }
  const itemsRef = useRef({})
  // roadName → { to_school, to_station, updatedAt } — 최신 폴링 결과 (클릭 핸들러 참조용)
  const roadDataRef = useRef({})
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
        // 다른 툴팁 모두 닫기
        Object.values(items).forEach(item => { item.tooltip.style.display = 'none' })
        if (alreadyOpen) return

        const cached = roadDataRef.current[roadName]
        if (!cached) return

        tooltip.style.display = 'block'
        renderTooltip(tooltip, roadName, cached)
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

  // 폴링 데이터 변경 시 원 색상 갱신 + roadDataRef 업데이트
  useEffect(() => {
    if (!data?.roads) return

    // 도로명별로 방향별 entry를 수집
    const byRoad = {}
    data.roads.forEach(road => {
      const bucket = byRoad[road.road_name] ?? (byRoad[road.road_name] = {})
      bucket[road.direction] = road
    })

    const updatedAt = data.updated_at
      ? new Date(data.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '—'

    Object.entries(byRoad).forEach(([roadName, dirs]) => {
      const entry = {
        to_school: dirs.to_school ?? null,
        to_station: dirs.to_station ?? null,
        updatedAt,
      }
      roadDataRef.current[roadName] = entry

      const item = itemsRef.current[roadName]
      if (!item) return

      // 양방향 중 최악 혼잡도로 원 색상 결정
      const worst = Math.max(
        entry.to_school?.congestion ?? 0,
        entry.to_station?.congestion ?? 0,
      )
      const color = CONGESTION_COLOR[worst] ?? '#94a3b8'
      item.circle.style.borderColor = color
      const statusText = CONGESTION_LABEL[worst] ?? ''
      item.label.textContent = statusText ? `마유로 ${statusText}` : ''
      item.label.style.color = color

      // 툴팁이 열려있으면 내용도 함께 갱신
      if (item.tooltip.style.display !== 'none') {
        renderTooltip(item.tooltip, roadName, entry)
      }
    })
  }, [data])

  return null
}
