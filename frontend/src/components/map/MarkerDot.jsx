/**
 * MarkerDot — 줌 레벨이 멀 때(> 5) 표시하는 단색 원 마커 콘텐츠.
 * 타입별 색상과 아이콘(흰색 SVG)이 함께 표시된다.
 *
 * 타입별 색상 기본값:
 *   bus / bus_seoul → shuttle  (#1b3a6e)
 *   subway          → suinbundang yellow (#F5A623)
 *   seohae          → seohae green (#75bf43)
 *   shuttle         → shuttle  (#1b3a6e)
 *
 * 두 가지 형태로 export:
 *   1. React 컴포넌트 (JSX)
 *   2. createMarkerDotElement() — kakao CustomOverlay setContent용 순수 DOM 노드 반환
 *
 * 다크 대응: border는 var(--tj-surface)로 배경색과 어울리게 처리.
 * 아이콘/도트 배경은 노선색(tjLineColor 우선, 없으면 TYPE_COLOR_MAP fallback) 사용.
 *
 * 히트 영역: 시각적으로 보이는 도트는 20px(+보더 2px)라 축소 지도에서 가장 흔히
 * 보이는 마커임에도 44px 터치 타깃에 크게 못 미쳤다. 시각 크기는 그대로 두고,
 * 바깥에 투명한 44x44 래퍼를 하나 더 둬서 탭 판정 영역만 넓힌다.
 */

import { tjLineColor } from '../common/lineColor'

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

function resolveTypeColor(type, customColor, routeCode) {
  if (customColor) return customColor
  // routeCode가 있으면 tjLineColor(CSS 변수) 우선 사용
  if (routeCode) {
    const lineVar = tjLineColor(routeCode)
    // tjLineColor는 항상 CSS 변수 또는 accent를 반환하므로 그대로 사용
    if (lineVar && lineVar !== 'var(--tj-accent)') return lineVar
  }
  return TYPE_COLOR_MAP[type] ?? '#1b3a6e'
}

function resolveTypeIcon(type) {
  return TYPE_ICON_MAP[type] ?? BUS_ICON_SVG
}

// React 컴포넌트 버전은 어디서도 쓰이지 않아 제거했다.

/**
 * kakao CustomOverlay setContent 용 순수 DOM 노드 반환.
 * @param {{ type: 'bus'|'bus_seoul'|'subway'|'seohae'|'shuttle', customColor?: string, routeCode?: string, onClick?: () => void }} options
 * @returns {HTMLElement}
 */
export function createMarkerDotElement({ type, customColor, routeCode, onClick }) {
  const color = resolveTypeColor(type, customColor, routeCode)
  const iconSvg = resolveTypeIcon(type)

  const dot = document.createElement('div')
  dot.style.cssText = [
    `width:${DOT_SIZE}px`,
    `height:${DOT_SIZE}px`,
    'border-radius:50%',
    `background:${color}`,
    'border:2px solid var(--tj-surface)',
    'box-shadow:0 2px 6px rgba(0,0,0,0.22)',
    'flex-shrink:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';')
  dot.innerHTML = iconSvg

  // 히트 영역 래퍼: 시각 크기(20px)는 그대로 두고 탭 판정 영역만 44x44로 넓힌다.
  // CustomOverlay의 xAnchor:0.5/yAnchor:1.0(하단 중앙)이 이 래퍼 기준으로도 그대로
  // 유지되도록 dot을 래퍼 하단 중앙에 붙인다(align-items:flex-end) — 그래야
  // 래퍼를 씌워도 지도 좌표 위 도트의 실제 표시 위치가 픽셀 단위로 밀리지 않는다.
  const hit = document.createElement('div')
  hit.style.cssText = [
    'width:44px',
    'height:44px',
    'display:flex',
    'align-items:flex-end',
    'justify-content:center',
    'cursor:pointer',
  ].join(';')
  hit.appendChild(dot)

  if (onClick) {
    hit.addEventListener('click', onClick)
  }

  return hit
}
