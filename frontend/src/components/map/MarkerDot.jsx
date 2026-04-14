/**
 * MarkerDot — 줌 레벨이 멀 때(> 5) 표시하는 14px 단색 원 마커 콘텐츠.
 * 교통수단 타입별 색상:
 *   bus    → navy  (#1b3a6e)
 *   subway → suinbundang yellow (#F5A623)
 *   shuttle→ coral (#FF385C)
 *
 * 두 가지 형태로 export:
 *   1. React 컴포넌트 (JSX)
 *   2. createMarkerDotElement() — kakao CustomOverlay setContent용 순수 DOM 노드 반환
 */

import React from 'react'

export const TYPE_COLOR_MAP = {
  bus:     '#1b3a6e',   // navy
  subway:  '#F5A623',   // suinbundang yellow
  shuttle: '#FF385C',   // coral
}

const DOT_SIZE = 14  // px

function resolveTypeColor(type, customColor) {
  if (customColor) return customColor
  return TYPE_COLOR_MAP[type] ?? '#1b3a6e'
}

/**
 * React 컴포넌트 버전.
 * @param {{ type: 'bus'|'subway'|'shuttle', customColor?: string }} props
 */
export default function MarkerDot({ type, customColor }) {
  const color = resolveTypeColor(type, customColor)

  return (
    <div
      style={{
        width: `${DOT_SIZE}px`,
        height: `${DOT_SIZE}px`,
        borderRadius: '50%',
        background: color,
        border: '2px solid rgba(255,255,255,0.85)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    />
  )
}

/**
 * kakao CustomOverlay setContent 용 순수 DOM 노드 반환.
 * @param {{ type: 'bus'|'subway'|'shuttle', customColor?: string, onClick?: () => void }} options
 * @returns {HTMLElement}
 */
export function createMarkerDotElement({ type, customColor, onClick }) {
  const color = resolveTypeColor(type, customColor)

  const div = document.createElement('div')
  div.style.cssText = [
    `width:${DOT_SIZE}px`,
    `height:${DOT_SIZE}px`,
    'border-radius:50%',
    `background:${color}`,
    'border:2px solid rgba(255,255,255,0.85)',
    'box-shadow:0 2px 6px rgba(0,0,0,0.22)',
    'cursor:pointer',
    'flex-shrink:0',
  ].join(';')

  if (onClick) {
    div.addEventListener('click', onClick)
  }

  return div
}
