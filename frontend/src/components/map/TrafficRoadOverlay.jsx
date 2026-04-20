import { useEffect, useRef } from 'react'
import { useApi } from '../../hooks/useApi'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * 백엔드 /api/v1/traffic 데이터를 지도 위 도로별 원형 오버레이로 시각화한다.
 * - 테두리 색상: 초록(원활) → 노랑(서행) → 주황(지체) → 빨강(정체)
 * - 클릭 시 도로명 · 혼잡도 · 평균속도 · 기준시각 + 20분 추이 그래프 툴팁 표시
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

// 혼잡도 레벨 → 원 안 표시 텍스트
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
    'min-width:130px',
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

/**
 * 히스토리 배열에서 기준 시각(ms)과 가장 가까운 항목을 반환한다.
 * 없으면 null.
 */
function pickClosest(history, targetMs) {
  if (!history.length) return null
  return history.reduce((best, cur) =>
    Math.abs(cur.ts - targetMs) < Math.abs(best.ts - targetMs) ? cur : best
  )
}

/** 3-point 부드러운 곡선 그래프 HTML. pts가 null이면 로딩 표시. */
function buildMiniGraph(pts) {
  const MAX_SPEED = 50  // 100% 높이 기준 속도 (km/h)
  const W = 130         // SVG 전체 폭
  const H = 36          // SVG 전체 높이 (곡선 영역)
  const PAD = 6         // 좌우 패딩
  const LABELS = ['20분 전', '10분 전', '지금']

  if (pts === null) {
    return `
      <div style="
        margin-top:7px;padding-top:6px;
        border-top:1px solid #f1f5f9;
        font-size:10px;color:#94a3b8;text-align:center
      ">불러오는 중…</div>`
  }

  // 3개 포인트의 x 좌표
  const xs = [PAD, W / 2, W - PAD]

  // y 좌표 계산 (속도 없으면 중간값)
  const ys = pts.map((pt) => {
    if (!pt) return H / 2
    const ratio = Math.min(pt.speed / MAX_SPEED, 1)
    return H - ratio * (H - 4) - 2  // 위가 빠름, 아래가 느림
  })

  // Catmull-Rom → cubic bezier 변환으로 부드러운 곡선 생성
  function smoothPath(xArr, yArr) {
    if (xArr.length < 2) return ''
    let d = `M ${xArr[0]} ${yArr[0]}`
    for (let i = 0; i < xArr.length - 1; i++) {
      const x0 = i > 0 ? xArr[i - 1] : xArr[0]
      const y0 = i > 0 ? yArr[i - 1] : yArr[0]
      const x1 = xArr[i], y1 = yArr[i]
      const x2 = xArr[i + 1], y2 = yArr[i + 1]
      const x3 = i + 2 < xArr.length ? xArr[i + 2] : x2
      const y3 = i + 2 < xArr.length ? yArr[i + 2] : y2
      const cp1x = x1 + (x2 - x0) / 6
      const cp1y = y1 + (y2 - y0) / 6
      const cp2x = x2 - (x3 - x1) / 6
      const cp2y = y2 - (y3 - y1) / 6
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2} ${y2}`
    }
    return d
  }

  const pathD = smoothPath(xs, ys)

  // 각 점의 색상
  const dotColors = pts.map((pt) => CONGESTION_COLOR[pt?.congestion] ?? '#94a3b8')
  // 선 색상 = 가장 나쁜 혼잡도 기준
  const worstCongestion = pts.reduce((w, pt) => Math.max(w, pt?.congestion ?? 0), 0)
  const lineColor = CONGESTION_COLOR[worstCongestion] ?? '#94a3b8'

  // 속도 레이블 (점 위에 작게)
  const speedLabels = pts.map((pt, i) => {
    if (!pt) return ''
    const textY = ys[i] - 5
    return `<text x="${xs[i]}" y="${textY}" text-anchor="middle"
      style="font-size:8px;fill:#64748b;font-family:sans-serif">${pt.speed}km</text>`
  }).join('')

  // 점
  const dots = xs.map((x, i) => {
    const color = dotColors[i]
    return `<circle cx="${x}" cy="${ys[i]}" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>`
  }).join('')

  // 하단 레이블
  const labelItems = LABELS.map((lbl, i) => `
    <div style="position:absolute;left:${xs[i]}px;transform:translateX(-50%);
      font-size:9px;color:#94a3b8;white-space:nowrap;top:0">${lbl}</div>
  `).join('')

  return `
    <div style="
      margin-top:7px;padding-top:6px;
      border-top:1px solid #f1f5f9;
    ">
      <svg width="${W}" height="${H}" style="display:block;overflow:visible">
        <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
        ${speedLabels}
        ${dots}
      </svg>
      <div style="position:relative;height:14px;width:${W}px">
        ${labelItems}
      </div>
    </div>`
}

/** 툴팁 HTML 전체를 갱신한다. pts가 null이면 로딩 상태로 렌더링. */
function renderTooltip(tooltip, roadName, road, updatedAt, pts) {
  const color = CONGESTION_COLOR[road.congestion] ?? '#94a3b8'
  tooltip.innerHTML = `
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:3px">${esc(roadName)}</div>
    <div style="font-size:12px;font-weight:600;color:${esc(color)};margin-bottom:2px">
      ${esc(road.congestion_label)} · ${esc(road.speed)}km/h
    </div>
    <div style="font-size:11px;color:#94a3b8">${esc(updatedAt)} 기준</div>
    ${buildMiniGraph(pts)}
    <div style="
      position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
      width:10px;height:5px;background:#fff;
      clip-path:polygon(0 0,100% 0,50% 100%)
    "></div>
  `
}

/** 서버에서 25분치 히스토리를 가져와 3개 포인트로 추출한다. */
async function fetchHistoryPts(roadName) {
  const since = new Date(Date.now() - 25 * 60 * 1000).toISOString()
  const url = `/api/v1/traffic/history?road_name=${encodeURIComponent(roadName)}&since=${encodeURIComponent(since)}&limit=50`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  // API는 collected_at 내림차순이므로 뒤집어서 오름차순으로
  const hist = (json.data ?? [])
    .map(r => ({
      ts: new Date(r.collected_at).getTime(),
      speed: Number(r.speed),
      congestion: r.congestion,
    }))
    .reverse()

  const now = Date.now()
  return [
    pickClosest(hist.filter(h => h.ts <= now - 18 * 60 * 1000), now - 20 * 60 * 1000),
    pickClosest(hist.filter(h => h.ts <= now -  8 * 60 * 1000), now - 10 * 60 * 1000),
    hist[hist.length - 1] ?? null,
  ]
}

export default function TrafficRoadOverlay({ map }) {
  // roadName → { overlay, tooltip, circle, label }
  const itemsRef = useRef({})
  // roadName → { road, updatedAt } — 최신 폴링 결과 보관 (클릭 핸들러에서 참조)
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

      wrapper.addEventListener('click', async (e) => {
        e.stopPropagation()
        const alreadyOpen = tooltip.style.display !== 'none'
        // 다른 툴팁 모두 닫기
        Object.values(items).forEach(item => { item.tooltip.style.display = 'none' })
        if (alreadyOpen) return

        const cached = roadDataRef.current[roadName]
        if (!cached) return

        // 로딩 상태로 즉시 표시
        tooltip.style.display = 'block'
        renderTooltip(tooltip, roadName, cached.road, cached.updatedAt, null)

        // 서버에서 히스토리 조회 후 그래프 반영
        try {
          const pts = await fetchHistoryPts(roadName)
          // 비동기 대기 중 닫혔으면 갱신하지 않음
          if (tooltip.style.display === 'none') return
          const latest = roadDataRef.current[roadName]
          if (latest) renderTooltip(tooltip, roadName, latest.road, latest.updatedAt, pts)
        } catch {
          // 실패해도 로딩 상태 유지 (null pts)
        }
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
      // 최신 데이터 저장 (클릭 핸들러에서 참조)
      roadDataRef.current[roadName] = { road, updatedAt }

      const item = itemsRef.current[roadName]
      if (!item) return

      const color = CONGESTION_COLOR[road.congestion] ?? '#94a3b8'
      item.circle.style.borderColor = color
      item.label.textContent = CONGESTION_LABEL[road.congestion] ?? ''
      item.label.style.color = color
    })
  }, [data])

  return null
}
