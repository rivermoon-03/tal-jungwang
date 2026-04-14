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
export default function MarkerChip({ routeCode, routeColor, stationName, liveMinutes, showLive = false }) {
  const color = resolveColor(routeCode, routeColor)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* 라이브 배지 (즐겨찾기 전용, showLive=true일 때만) */}
      {showLive && liveMinutes != null && (
        <div
          style={{
            background: '#FF385C',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: '99px',
            padding: '1px 6px',
            marginBottom: '2px',
            boxShadow: '0 2px 6px rgba(255,56,92,0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          {liveMinutes}분
        </div>
      )}

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
          maxWidth: '160px',
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
          {(routeCode ?? '').slice(0, 3)}
        </span>

        {/* 정류장명 */}
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
export function createMarkerChipElement({ routeCode, routeColor, stationName, liveMinutes, showLive = false, onClick }) {
  const color = resolveColor(routeCode, routeColor)

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'flex-direction:column',
    'align-items:center',
    'cursor:pointer',
  ].join(';')

  // 라이브 배지
  if (showLive && liveMinutes != null) {
    const badge = document.createElement('div')
    badge.style.cssText = [
      'background:#FF385C',
      'color:#fff',
      'font-size:10px',
      'font-weight:700',
      'border-radius:99px',
      'padding:1px 6px',
      'margin-bottom:2px',
      'box-shadow:0 2px 6px rgba(255,56,92,0.35)',
      'white-space:nowrap',
    ].join(';')
    badge.textContent = `${liveMinutes}분`
    wrapper.appendChild(badge)
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
    'max-width:160px',
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
  dot.textContent = (routeCode ?? '').slice(0, 3)
  pill.appendChild(dot)

  // 정류장명
  const label = document.createElement('span')
  label.style.cssText = [
    'font-size:11px',
    'font-weight:700',
    'color:#1b3a6e',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';')
  label.textContent = stationName
  pill.appendChild(label)

  wrapper.appendChild(pill)

  if (onClick) {
    wrapper.addEventListener('click', onClick)
  }

  return wrapper
}
