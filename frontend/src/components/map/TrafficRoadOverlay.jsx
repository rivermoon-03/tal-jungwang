import { useEffect, useRef } from 'react'
import { useApi } from '../../hooks/useApi'
import { CONGESTION_COLOR, CONGESTION_LABEL } from './trafficLevels'

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

// direction 코드 → 한글 라벨
const DIRECTION_LABEL = {
  to_school: '등교방향',
  to_station: '하교방향',
}

const RING_SIZE = 24

// 자동차 글리프(흰색 stroke). 정류장 마커의 버스/열차 글리프와 같은 11px 규격.
const CAR_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h-2v-6l2-5h12l2 5v6h-2"/><path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/><path d="M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/><path d="M5 11h14"/></svg>'

/** 오버레이 DOM 구조 생성. 반환값을 ref에 저장해 업데이트에 재사용한다.
 *  예전엔 "마유로 혼잡" 글자가 든 28px 노란 알약이었다. 정류장 칩과 같은 알약
 *  문법이라 정류장으로 오해됐고, 클러스터 배지 바로 위에 겹쳤다(실측). 지금은
 *  글자 없는 24px 색 링 하나다. 뜻은 범례(MapLegendOnboarding)가 설명하고,
 *  탭하면 툴팁이 도로명과 속도를 보여준다. */
function createOverlayDOM() {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative;display:inline-block;cursor:pointer'

  const tooltip = document.createElement('div')
  tooltip.style.cssText = [
    'display:none',
    'position:absolute',
    `bottom:${RING_SIZE + 8}px`,
    'left:50%',
    'transform:translateX(-50%)',
    'background:var(--tj-surface)',
    'border-radius:8px',
    'padding:8px 12px',
    'box-shadow:0 4px 14px rgba(0,0,0,0.22)',
    'white-space:nowrap',
    'min-width:150px',
    'cursor:pointer',
    'z-index:10',
  ].join(';')

  const circle = document.createElement('div')
  circle.setAttribute('role', 'img')
  circle.style.cssText = [
    `width:${RING_SIZE}px`,
    `height:${RING_SIZE}px`,
    'border-radius:9999px',
    'background:var(--tj-surface)',
    'border:3px solid var(--tj-line)',
    'box-shadow:0 2px 6px rgba(0,0,0,0.22)',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'color:var(--tj-mute)',
  ].join(';')
  circle.innerHTML = CAR_ICON_SVG

  wrapper.appendChild(tooltip)
  wrapper.appendChild(circle)

  // label 은 색을 받는 요소를 가리킨다(글리프 색). 글자는 더 이상 그리지 않는다.
  return { wrapper, tooltip, circle, label: circle }
}

/** 방향별 한 줄 HTML. road가 없으면 "정보 없음" 표시(자리표시 대시 대신 말로 설명). */
function directionRow(directionCode, road) {
  const name = DIRECTION_LABEL[directionCode] ?? directionCode
  if (!road) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;margin-top:3px">
        <span style="color:var(--tj-mute)">${esc(name)}</span>
        <span style="color:var(--tj-mute)">정보 없음</span>
      </div>`
  }
  const color = CONGESTION_COLOR[road.congestion] ?? 'var(--tj-mute)'
  return `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;margin-top:3px">
      <span style="color:var(--tj-mute)">${esc(name)}</span>
      <span style="font-weight:600;color:${esc(color)}">${esc(road.speed)}km/h · ${esc(road.congestion_label)}</span>
    </div>`
}

/** 툴팁 HTML 전체를 갱신한다. */
function renderTooltip(tooltip, roadName, entry) {
  tooltip.innerHTML = `
    <div style="font-weight:700;font-size:13px;color:var(--tj-ink);margin-bottom:4px">${esc(roadName)}</div>
    ${directionRow('to_school', entry.to_school)}
    ${directionRow('to_station', entry.to_station)}
    <div style="font-size:12px;color:var(--tj-mute);margin-top:6px">${esc(entry.updatedAt)} 기준</div>
    <div style="
      position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
      width:10px;height:5px;background:var(--tj-surface);
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
        // 정류장 마커(4)보다 아래. 도로 표시가 정류장을 가리면 안 된다.
        zIndex: 2,
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
      : '-'

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
      item.circle.setAttribute('aria-label', statusText ? `${roadName} ${statusText}` : roadName)
      item.label.style.color = color

      // 툴팁이 열려있으면 내용도 함께 갱신
      if (item.tooltip.style.display !== 'none') {
        renderTooltip(item.tooltip, roadName, entry)
      }
    })
  }, [data])

  return null
}
