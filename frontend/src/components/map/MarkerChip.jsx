/**
 * MarkerChip — 줌 레벨이 가까울 때(≤5) 사용하는 pill 형태 마커 콘텐츠.
 * 두 가지 형태로 export:
 *   1. React 컴포넌트 (JSX) — 일반 React 렌더에서 사용
 *   2. createMarkerChipElement() — kakao CustomOverlay setContent용 순수 DOM 노드 반환
 */

import React from 'react'

/** 노선 코드 → 헥스 색상 (tailwind.config.js의 route-* 색과 일치) */
export const ROUTE_COLOR_MAP = {
  '20-1':   '#2563EB',
  '시흥33': '#0891B2',
  '시흥1':  '#F97316',
  '수인분당': '#F5A623',
  '4호선':  '#1B5FAD',
  '서해선': '#75bf43',
  '셔틀':   '#FF385C',  // coral
  '지하철': '#F5A623',
  'bus':    '#1b3a6e',   // navy
  'subway': '#F5A623',
  'shuttle':'#FF385C',
}

/** 기본 fallback 색 */
const DEFAULT_COLOR = '#1b3a6e'

function resolveColor(routeCode, routeColor) {
  if (routeColor) return routeColor
  return ROUTE_COLOR_MAP[routeCode] ?? DEFAULT_COLOR
}

/**
 * React 컴포넌트 버전.
 * @param {{ routeCode: string, routeColor?: string, stationName: string, liveMinutes?: number|null, showLive?: boolean }} props
 */
export default function MarkerChip({ routeCode, routeColor, stationName, liveMinutes, showLive = false, badgeText }) {
  const color = resolveColor(routeCode, routeColor)
  const hasLive = showLive && liveMinutes != null

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Pill 본체 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: '#fff',
          borderRadius: '16px',
          padding: '4px 10px 4px 6px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          maxWidth: '180px',
        }}
      >
        {/* 노선 색 원 */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: color,
            color: '#fff',
            fontSize: '9px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {badgeText ?? (routeCode ?? '').slice(0, 3)}
        </span>

        {/* 정류장명 + 남은 시간 */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#1b3a6e',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {stationName}
          {hasLive && (
            <>
              <span style={{ color: '#cbd5e1', margin: '0 4px' }}>·</span>
              <span style={{ color: '#FF385C' }}>{liveMinutes}분</span>
            </>
          )}
        </span>
      </div>
    </div>
  )
}

/**
 * kakao CustomOverlay setContent 용 순수 DOM 노드 반환.
 * @param {{ routeCode: string, routeColor?: string, stationName: string, liveMinutes?: number|null, showLive?: boolean, onClick?: () => void }} options
 * @returns {HTMLElement}
 */
export function createMarkerChipElement({ routeCode, routeColor, stationName, liveMinutes, showLive = false, inaccurate = false, onClick, badgeText, extraPillText = null, subLabel = null }) {
  const color = resolveColor(routeCode, routeColor)

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'flex-direction:column',
    'align-items:center',
    'cursor:pointer',
  ].join(';')

  const hasLive = showLive && liveMinutes != null

  // 보조 pill (메인 pill 위에 작게 표시)
  if (extraPillText) {
    const extra = document.createElement('div')
    extra.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:4px',
      'background:#DC2626',
      'color:#fff',
      'font-size:9px',
      'font-weight:700',
      'border-radius:10px',
      'padding:2px 7px',
      'box-shadow:0 2px 6px rgba(0,0,0,0.15)',
      'margin-bottom:3px',
      'white-space:nowrap',
    ].join(';')
    extra.textContent = extraPillText
    wrapper.appendChild(extra)
  }

  // Pill 본체
  const pill = document.createElement('div')
  pill.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:5px',
    'background:#fff',
    'border-radius:16px',
    'padding:4px 10px 4px 6px',
    'box-shadow:0 4px 14px rgba(0,0,0,0.1)',
    'user-select:none',
    'white-space:nowrap',
    'max-width:180px',
  ].join(';')

  // 노선 색 원
  const dot = document.createElement('span')
  dot.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:18px',
    'height:18px',
    'border-radius:50%',
    `background:${color}`,
    'color:#fff',
    'font-size:9px',
    'font-weight:700',
    'flex-shrink:0',
  ].join(';')
  dot.textContent = badgeText ?? (routeCode ?? '').slice(0, 3)
  pill.appendChild(dot)

  // 정류장명 + 남은 시간
  const label = document.createElement('span')
  label.style.cssText = [
    'font-size:11px',
    'font-weight:700',
    'color:#1b3a6e',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';')
  if (subLabel) {
    // subLabel이 있으면 라이브 시간 대신 표시 (다중 노선 허브 등)
    label.textContent = stationName
    const sep = document.createElement('span')
    sep.style.cssText = 'color:#cbd5e1;margin:0 4px'
    sep.textContent = '·'
    label.appendChild(sep)
    const tail = document.createElement('span')
    tail.style.color = '#1b3a6e'
    tail.textContent = subLabel
    label.appendChild(tail)
  } else if (hasLive) {
    label.textContent = stationName
    const sep = document.createElement('span')
    sep.style.cssText = 'color:#cbd5e1;margin:0 4px'
    sep.textContent = '·'
    label.appendChild(sep)
    const mins = document.createElement('span')
    mins.style.color = '#FF385C'
    mins.textContent = `${liveMinutes}분`
    label.appendChild(mins)
    if (inaccurate) {
      const tag = document.createElement('span')
      tag.style.cssText = 'margin-left:4px;font-size:9px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:6px;padding:1px 4px'
      tag.textContent = '부정확'
      label.appendChild(tag)
    }
  } else {
    label.textContent = stationName
  }
  pill.appendChild(label)

  wrapper.appendChild(pill)

  if (onClick) {
    wrapper.addEventListener('click', onClick)
  }

  return wrapper
}

/**
 * 정왕역 전용 — 수인분당선·4호선 상/하행 2x2 그리드 오버레이.
 * @param {{ subwayData: { up, down, line4_up, line4_down }|null, onClick?: () => void }} opts
 */
export function createSubwayMultiChipElement({ subwayData, onClick }) {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative;display:inline-flex;cursor:pointer'

  const pill = document.createElement('div')
  pill.style.cssText = [
    'display:grid',
    'grid-template-columns:auto auto',
    'gap:4px 8px',
    'background:#fff',
    'border-radius:14px',
    'padding:6px 10px',
    'box-shadow:0 4px 14px rgba(0,0,0,0.1)',
    'user-select:none',
    'white-space:nowrap',
  ].join(';')

  const LINES = [
    { key: 'up',        label: '수인', color: '#F5A623', arrow: '↑' },
    { key: 'line4_up',  label: '4호선', color: '#1B5FAD', arrow: '↑' },
    { key: 'down',      label: '수인', color: '#F5A623', arrow: '↓' },
    { key: 'line4_down',label: '4호선', color: '#1B5FAD', arrow: '↓' },
  ]

  for (const line of LINES) {
    const entry = subwayData?.[line.key]
    const minutes = entry?.arrive_in_seconds != null
      ? Math.max(0, Math.round(entry.arrive_in_seconds / 60))
      : null

    const cell = document.createElement('span')
    cell.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#1b3a6e'

    const badge = document.createElement('span')
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-width:22px',
      'height:16px',
      'padding:0 5px',
      'border-radius:8px',
      `background:${line.color}`,
      'color:#fff',
      'font-size:9px',
      'font-weight:700',
    ].join(';')
    badge.textContent = `${line.label}${line.arrow}`
    cell.appendChild(badge)

    const mins = document.createElement('span')
    mins.style.color = minutes != null ? '#FF385C' : '#94a3b8'
    mins.textContent = minutes != null ? `${minutes}분` : '—'
    cell.appendChild(mins)

    pill.appendChild(cell)
  }

  wrapper.appendChild(pill)
  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}
