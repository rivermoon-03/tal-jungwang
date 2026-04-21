/**
 * MarkerDot — 줌 레벨이 멀 때(> 5) 표시하는 단색 원 마커 콘텐츠.
 * 타입별 색상과 아이콘(흰색 SVG)이 함께 표시된다.
 *
 * 타입별 색상 기본값:
 *   bus / bus_seoul → navy  (#1b3a6e)
 *   subway          → suinbundang yellow (#F5A623)
 *   seohae          → seohae green (#75bf43)
 *   shuttle         → navy  (#1b3a6e)
 *
 * 두 가지 형태로 export:
 *   1. React 컴포넌트 (JSX)
 *   2. createMarkerDotElement() — kakao CustomOverlay setContent용 순수 DOM 노드 반환
 */

import React from 'react'

export const TYPE_COLOR_MAP = {
  bus:       '#1b3a6e',
  bus_seoul: '#DC2626',
  subway:    '#F5A623',
  seohae:    '#75bf43',
  shuttle:   '#1b3a6e',
}

// 흰색 stroke SVG 아이콘. 11x11로 20px 도트 중앙에 배치.
const BUS_ICON_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>'
const TRAIN_ICON_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M8 3v8"/><path d="M16 3v8"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/><path d="M8 19l-2 3"/><path d="M16 19l2 3"/></svg>'

const TYPE_ICON_MAP = {
  bus:       BUS_ICON_SVG,
  bus_seoul: BUS_ICON_SVG,
  shuttle:   BUS_ICON_SVG,
  subway:    TRAIN_ICON_SVG,
  seohae:    TRAIN_ICON_SVG,
}

const DOT_SIZE = 20 // px

function resolveTypeColor(type, customColor) {
  if (customColor) return customColor
  return TYPE_COLOR_MAP[type] ?? '#1b3a6e'
}

function resolveTypeIcon(type) {
  return TYPE_ICON_MAP[type] ?? BUS_ICON_SVG
}

/**
 * React 컴포넌트 버전.
 * @param {{ type: 'bus'|'bus_seoul'|'subway'|'seohae'|'shuttle', customColor?: string }} props
 */
export default function MarkerDot({ type, customColor }) {
  const color = resolveTypeColor(type, customColor)
  const iconSvg = resolveTypeIcon(type)

  return (
    <div
      style={{
        width: `${DOT_SIZE}px`,
        height: `${DOT_SIZE}px`,
        borderRadius: '50%',
        background: color,
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: iconSvg }}
    />
  )
}

/**
 * kakao CustomOverlay setContent 용 순수 DOM 노드 반환.
 * @param {{ type: 'bus'|'bus_seoul'|'subway'|'seohae'|'shuttle', customColor?: string, onClick?: () => void }} options
 * @returns {HTMLElement}
 */
export function createMarkerDotElement({ type, customColor, onClick }) {
  const color = resolveTypeColor(type, customColor)
  const iconSvg = resolveTypeIcon(type)

  const div = document.createElement('div')
  div.style.cssText = [
    `width:${DOT_SIZE}px`,
    `height:${DOT_SIZE}px`,
    'border-radius:50%',
    `background:${color}`,
    'border:2px solid rgba(255,255,255,0.9)',
    'box-shadow:0 2px 6px rgba(0,0,0,0.22)',
    'cursor:pointer',
    'flex-shrink:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';')
  div.innerHTML = iconSvg

  if (onClick) {
    div.addEventListener('click', onClick)
  }

  return div
}
