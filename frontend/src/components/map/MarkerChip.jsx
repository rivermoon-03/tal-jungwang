/**
 * MarkerChip — 시안2 카드 분리형 마커 칩.
 *
 * 구조: [노선색 리드블록 | 정류장명(mute) / 실시간 big(ink·imminent)]
 * 호출처: ZoomAwareOverlayManager.jsx (kakao CustomOverlay setContent용)
 * MarkerSheet: ROUTE_COLOR_MAP만 import
 *
 * 다크 대응: 배경 var(--tj-surface), 텍스트 var(--tj-ink), 임박 var(--tj-imminent).
 */

import React from 'react'

/** 노선 코드 → 헥스 색상 (tailwind.config.js의 route-* 색과 일치) */
export const ROUTE_COLOR_MAP = {
  '20-1':   '#2563EB',
  '시흥33': '#0891B2',
  '11-A':   '#0891B2',
  '시흥1':  '#F97316',
  '수인분당': '#F5A623',
  '4호선':  '#1B5FAD',
  '서해선': '#75bf43',
  '셔틀':   '#2E8B86',
  '지하철': '#F5A623',
  'bus':    '#2563EB',
  'subway': '#F5A623',
  'shuttle':'#2E8B86',
}

/** 기본 fallback 색 */
const DEFAULT_COLOR = '#2563EB'

function resolveColor(routeCode, routeColor) {
  if (routeColor) return routeColor
  return ROUTE_COLOR_MAP[routeCode] ?? DEFAULT_COLOR
}

/** ETA가 임박(3분 이하)인지 판단 */
function isImminent(minutes) {
  return typeof minutes === 'number' && minutes <= 3
}

// ─────────────────────────────────────────────────────────────
// 공통 DOM 빌더: 시안2 칩 래퍼(pin) 구조 생성
// wrapper
//   └ chip (lead | body)
//   └ tail
// ─────────────────────────────────────────────────────────────

/** 꼬리 삼각형 요소 */
function makeTail() {
  const tail = document.createElement('div')
  tail.setAttribute('data-role', 'tail')
  tail.style.cssText = [
    'width:0',
    'height:0',
    'border-left:6px solid transparent',
    'border-right:6px solid transparent',
    'border-top:7px solid var(--tj-surface)',
    'margin-top:-1px',
    'filter:drop-shadow(0 2px 2px rgba(27,42,74,.14))',
  ].join(';')
  return tail
}

/** 리드 블록 (좌측 노선색 배경) */
function makeLead({ color, text }) {
  const lead = document.createElement('div')
  lead.setAttribute('data-role', 'lead')
  lead.style.cssText = [
    'width:36px',
    'flex:none',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    `background:${color}`,
    'color:#fff',
    'font-size:13px',
    'font-weight:800',
    'letter-spacing:-0.01em',
  ].join(';')
  lead.textContent = text
  return lead
}

/**
 * React 컴포넌트 버전 (미리보기/스토리용).
 */
export default function MarkerChip({ routeCode, routeColor, stationName, liveMinutes, showLive = false, badgeText, subLabel }) {
  const color = resolveColor(routeCode, routeColor)
  const hasLive = showLive && liveMinutes != null
  const imminentEta = hasLive && isImminent(liveMinutes)
  const leadText = badgeText ?? (routeCode ?? '').slice(0, 4)

  const bigText = hasLive
    ? `${liveMinutes}분 후 도착`
    : subLabel ?? '시간표'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* chip2: lead | body */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'stretch',
          background: 'var(--tj-surface)',
          border: '1px solid var(--tj-line, #E7E4DF)',
          borderRadius: '13px',
          boxShadow: '0 4px 12px rgba(27,42,74,.14)',
          overflow: 'hidden',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          maxWidth: '200px',
        }}
      >
        {/* 리드 블록 */}
        <span
          data-role="lead"
          style={{
            width: '36px',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: color,
            color: '#fff',
            fontSize: '13px',
            fontWeight: 800,
          }}
        >
          {leadText}
        </span>

        {/* 본문 */}
        <span
          data-role="body"
          style={{ padding: '5px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <span
            data-role="name"
            style={{ fontSize: '13px', color: 'var(--tj-mute, #5A6678)', fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            {stationName}
          </span>
          <span
            data-role="big"
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: imminentEta ? 'var(--tj-imminent)' : 'var(--tj-ink)',
              letterSpacing: '-0.01em',
              marginTop: '1px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {bigText}
          </span>
        </span>
      </div>

      {/* 꼬리 */}
      <div
        data-role="tail"
        style={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '7px solid var(--tj-surface)',
          marginTop: '-1px',
          filter: 'drop-shadow(0 2px 2px rgba(27,42,74,.14))',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// createMarkerChipElement — kakao CustomOverlay 용
// 시안2: lead(노선색) | body(name/big) + tail
// ─────────────────────────────────────────────────────────────

export function createMarkerChipElement({
  routeCode,
  routeColor,
  stationName,
  liveMinutes,
  showLive = false,
  inaccurate = false,
  onClick,
  badgeText,
  extraPillText = null,
  subLabel = null,
  iconType = null,
  subLabelSep = '·',
}) {
  const color = resolveColor(routeCode, routeColor)
  const hasLive = showLive && liveMinutes != null
  const imminentEta = hasLive && isImminent(liveMinutes)
  const leadText = badgeText ?? (routeCode ?? '').slice(0, 4)

  // 래퍼 (pin): flex-column, align-items:center
  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'flex-direction:column',
    'align-items:center',
    'cursor:pointer',
  ].join(';')

  // 선택적 보조 pill (extraPillText: 막차 임박 등)
  if (extraPillText) {
    const extra = document.createElement('div')
    extra.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:4px',
      'background:#DC2626',
      'color:#fff',
      'font-size:13px',
      'font-weight:800',
      'border-radius:10px',
      'padding:2px 8px',
      'box-shadow:0 2px 6px rgba(27,42,74,0.15)',
      'margin-bottom:4px',
      'white-space:nowrap',
    ].join(';')
    extra.textContent = extraPillText
    wrapper.appendChild(extra)
  }

  // 칩 본체: chip2
  const chip = document.createElement('div')
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:stretch',
    'background:var(--tj-surface)',
    'border:1px solid #E7E4DF',
    'border-radius:13px',
    'box-shadow:0 4px 12px rgba(27,42,74,.14)',
    'overflow:hidden',
    'user-select:none',
    'white-space:nowrap',
    'max-width:200px',
  ].join(';')

  // 리드 블록
  chip.appendChild(makeLead({ color, text: leadText }))

  // 본문 블록
  const body = document.createElement('div')
  body.setAttribute('data-role', 'body')
  body.style.cssText = [
    'padding:5px 11px',
    'display:flex',
    'flex-direction:column',
    'justify-content:center',
  ].join(';')

  // .name: 정류장명 (ink, 13px)
  const nameEl = document.createElement('span')
  nameEl.setAttribute('data-role', 'name')
  nameEl.style.cssText = [
    'font-size:13px',
    'color:var(--tj-ink)',
    'font-weight:700',
    'letter-spacing:-0.01em',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';')
  nameEl.textContent = stationName
  body.appendChild(nameEl)

  // .big: 실시간 / 서브레이블 (15px, ink or imminent)
  const bigEl = document.createElement('span')
  bigEl.setAttribute('data-role', 'big')
  bigEl.style.cssText = [
    'font-size:15px',
    'font-weight:800',
    `color:${imminentEta ? 'var(--tj-imminent)' : 'var(--tj-ink)'}`,
    'letter-spacing:-0.01em',
    'margin-top:1px',
    'font-variant-numeric:tabular-nums',
  ].join(';')

  if (hasLive) {
    const minSpan = document.createElement('span')
    minSpan.textContent = `${liveMinutes}`
    bigEl.appendChild(minSpan)
    const unitSpan = document.createElement('span')
    unitSpan.style.cssText = 'font-size:13px;font-weight:700;color:var(--tj-mute,#5A6678)'
    unitSpan.textContent = '분'
    bigEl.appendChild(unitSpan)
    if (liveMinutes <= 3) {
      const arrText = document.createElement('span')
      arrText.textContent = ' 후 도착'
      arrText.style.fontSize = '13px'
      bigEl.appendChild(arrText)
    }
    if (inaccurate) {
      const tag = document.createElement('span')
      tag.style.cssText = [
        'margin-left:5px',
        'font-size:13px',
        'font-weight:700',
        'color:#b45309',
        'background:#fef3c7',
        'border-radius:6px',
        'padding:1px 5px',
      ].join(';')
      tag.textContent = '부정확'
      bigEl.appendChild(tag)
    }
  } else if (subLabel) {
    bigEl.textContent = `${subLabel}`
  } else {
    bigEl.style.color = 'var(--tj-ink)'
    bigEl.textContent = subLabel ? String(subLabel) : '시간표'
  }
  body.appendChild(bigEl)

  chip.appendChild(body)
  wrapper.appendChild(chip)

  // 꼬리 삼각형
  wrapper.appendChild(makeTail())

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}

// ─────────────────────────────────────────────────────────────
// createSubwayMultiChipElement — 정왕역 수인분당·4호선 시안2
// lead: "정왕역" 역명 배지 / body: 노선별 상/하행 그리드
// ─────────────────────────────────────────────────────────────

export function createSubwayMultiChipElement({ subwayData, onClick }) {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'flex-direction:column',
    'align-items:center',
    'cursor:pointer',
  ].join(';')

  // 칩 본체
  const chip = document.createElement('div')
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:stretch',
    'background:var(--tj-surface)',
    'border:1px solid #E7E4DF',
    'border-radius:13px',
    'box-shadow:0 4px 12px rgba(27,42,74,.14)',
    'overflow:hidden',
    'user-select:none',
    'white-space:nowrap',
  ].join(';')

  // 리드 블록: 수인분당 색 (#F5A623) + "정왕" 두 글자
  chip.appendChild(makeLead({ color: '#F5A623', text: '정왕' }))
  chip.querySelector('[data-role="lead"]').setAttribute('data-role', 'lead')

  // 본문 블록: 2x2 그리드
  const body = document.createElement('div')
  body.setAttribute('data-role', 'body')
  body.style.cssText = [
    'padding:5px 11px',
    'display:grid',
    'grid-template-columns:auto auto',
    'gap:3px 10px',
    'align-items:center',
  ].join(';')

  const LINES = [
    { key: 'up',         label: '수인↑', color: '#F5A623' },
    { key: 'line4_up',   label: '4호↑',  color: '#1B5FAD' },
    { key: 'down',       label: '수인↓', color: '#F5A623' },
    { key: 'line4_down', label: '4호↓',  color: '#1B5FAD' },
  ]

  for (const line of LINES) {
    const entry = subwayData?.[line.key]
    const minutes = entry?.arrive_in_seconds != null
      ? Math.max(0, Math.ceil(entry.arrive_in_seconds / 60))
      : null
    const imm = isImminent(minutes)

    const cell = document.createElement('div')
    cell.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:4px',
    ].join(';')

    // 노선 배지
    const badge = document.createElement('span')
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'padding:0 6px',
      'height:18px',
      'border-radius:8px',
      `background:${line.color}`,
      'color:#fff',
      'font-size:13px',
      'font-weight:800',
      'flex-shrink:0',
    ].join(';')
    badge.textContent = line.label
    cell.appendChild(badge)

    // 분 표시 (big: 15px)
    const bigEl = document.createElement('span')
    bigEl.setAttribute('data-role', 'big')
    bigEl.style.cssText = [
      'font-size:15px',
      'font-weight:800',
      `color:${imm ? 'var(--tj-imminent)' : (minutes != null ? 'var(--tj-ink)' : 'var(--tj-mute,#5A6678)')}`,
      'font-variant-numeric:tabular-nums',
      'letter-spacing:-0.01em',
    ].join(';')
    bigEl.textContent = minutes != null ? `${minutes}분` : '—'
    // null(데이터 없음)이면 ink(—) 표시
    if (minutes == null && !imm) bigEl.style.color = 'var(--tj-ink)'
    cell.appendChild(bigEl)

    body.appendChild(cell)
  }

  chip.appendChild(body)
  wrapper.appendChild(chip)
  wrapper.appendChild(makeTail())

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}

// ─────────────────────────────────────────────────────────────
// createSeohaeSiheungChipElement — 시흥시청역 서해선 시안2
// lead: 서해선 색 + "서해선" / body: 역명 + 상/하행 big
// ─────────────────────────────────────────────────────────────

export function createSeohaeSiheungChipElement({ stationName, upMinutes, dnMinutes, earliestBus, onClick }) {
  const SEOHAE = '#75bf43'
  const BUS_COLOR = '#DC2626'

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'flex-direction:column',
    'align-items:center',
    'cursor:pointer',
  ].join(';')

  // 칩 본체
  const chip = document.createElement('div')
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:stretch',
    'background:var(--tj-surface)',
    'border:1px solid #E7E4DF',
    'border-radius:13px',
    'box-shadow:0 4px 12px rgba(27,42,74,.14)',
    'overflow:hidden',
    'user-select:none',
    'white-space:nowrap',
    'min-width:140px',
  ].join(';')

  // 리드 블록: 서해선 녹색
  chip.appendChild(makeLead({ color: SEOHAE, text: '서해' }))

  // 본문 블록
  const body = document.createElement('div')
  body.setAttribute('data-role', 'body')
  body.style.cssText = [
    'padding:5px 11px',
    'display:flex',
    'flex-direction:column',
    'justify-content:center',
    'gap:2px',
  ].join(';')

  // 역명 (.name: mute, 13px)
  const nameEl = document.createElement('div')
  nameEl.setAttribute('data-role', 'name')
  nameEl.style.cssText = [
    'font-size:13px',
    'color:var(--tj-mute,#5A6678)',
    'font-weight:600',
    'letter-spacing:-0.01em',
  ].join(';')
  nameEl.textContent = stationName
  body.appendChild(nameEl)

  // 상/하행 행 빌더
  const makeRow = ({ badgeBg, badgeText, minutes }) => {
    const row = document.createElement('div')
    row.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:5px',
    ].join(';')

    const badge = document.createElement('span')
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'padding:0 6px',
      'height:18px',
      'border-radius:8px',
      `background:${badgeBg}`,
      'color:#fff',
      'font-size:13px',
      'font-weight:700',
      'flex-shrink:0',
    ].join(';')
    badge.textContent = badgeText
    row.appendChild(badge)

    const imm = isImminent(minutes)
    const bigEl = document.createElement('span')
    bigEl.setAttribute('data-role', 'big')
    bigEl.style.cssText = [
      'font-size:15px',
      'font-weight:800',
      `color:${imm ? 'var(--tj-imminent)' : (minutes != null ? 'var(--tj-ink)' : 'var(--tj-mute,#5A6678)')}`,
      'font-variant-numeric:tabular-nums',
      'letter-spacing:-0.01em',
    ].join(';')
    bigEl.textContent = minutes != null ? `${minutes}분` : '—'
    row.appendChild(bigEl)

    return row
  }

  body.appendChild(makeRow({ badgeBg: SEOHAE, badgeText: '상행', minutes: upMinutes }))
  body.appendChild(makeRow({ badgeBg: SEOHAE, badgeText: '하행', minutes: dnMinutes }))

  if (earliestBus) {
    body.appendChild(makeRow({
      badgeBg: BUS_COLOR,
      badgeText: earliestBus.routeNo,
      minutes: earliestBus.minutes,
    }))
  }

  chip.appendChild(body)
  wrapper.appendChild(chip)
  wrapper.appendChild(makeTail())

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}
