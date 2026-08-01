/**
 * MarkerChip — 시안1 정보 밀도형 마커 칩.
 *
 * 구조: pill(border-radius:999px) · [dot 22x22 | name 14px | live/sub 14px]
 * 한 줄 압축 알약형으로 지도 겹침을 방지한다.
 *
 * 호출처: ZoomAwareOverlayManager.jsx (kakao CustomOverlay setContent용)
 * MarkerSheet: ROUTE_COLOR_MAP만 import — 시트는 별도 유지.
 *
 * 다크 대응: 배경 var(--tj-surface), 텍스트 var(--tj-ink), 임박 var(--tj-imminent).
 */


/** 노선 코드 → 헥스 색상 (tailwind.config.js의 route-* 색과 일치) */
export const ROUTE_COLOR_MAP = {
  '20-1':   '#2563EB',
  '시흥33': '#0891B2',
  '11-A':   '#0891B2',
  '시흥1':  '#F97316',
  '수인분당': '#F5A623',
  '4호선':  '#1B5FAD',
  '서해선': '#75bf43',
  '셔틀':   '#12a594',
  '지하철': '#F5A623',
  'bus':    '#2563EB',
  'subway': '#F5A623',
  'shuttle':'#12a594',
}

/** 기본 fallback 색 */
const DEFAULT_COLOR = '#2563EB'

export function resolveColor(routeCode, routeColor) {
  if (routeColor) return routeColor
  return ROUTE_COLOR_MAP[routeCode] ?? DEFAULT_COLOR
}

/** ETA가 임박(3분 이하)인지 판단 */
function isImminent(minutes) {
  return typeof minutes === 'number' && minutes <= 3
}

// ─────────────────────────────────────────────────────────────
// 공통 DOM 빌더: 시안1 칩 래퍼(pin) 구조
// wrapper(pin)
//   └ chip(pill: 999px)
//       └ dot(22x22 원형 배지)  name  live/sub
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

/** 22x22 원형 색 배지 (dot) */
function makeDot({ color, text }) {
  const dot = document.createElement('span')
  dot.setAttribute('data-role', 'dot')
  dot.style.cssText = [
    'width:22px',
    'height:22px',
    'border-radius:999px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    `background:${color}`,
    'color:#fff',
    'font-size:12px',
    'font-weight:800',
    'flex-shrink:0',
  ].join(';')
  dot.textContent = text
  return dot
}

/**
 * blip 펄스 도트 (라이브 표시용).
 * ui/DataBadge.jsx의 live 상태 점과 동일한 tailwind 애니메이션(animate-dot-blink)을
 * 재사용해, 지도 마커 칩과 카드형 배지의 "실시간" 펄스 문법을 통일한다.
 * 클래스 기반 애니메이션이라 index.css의 전역 prefers-reduced-motion 규칙을 그대로 따른다.
 */
function makeBlip(imminentEta) {
  const blip = document.createElement('span')
  blip.setAttribute('data-role', 'blip')
  blip.className = 'animate-dot-blink'
  blip.style.cssText = [
    'width:6px',
    'height:6px',
    'border-radius:999px',
    `background:${imminentEta ? 'var(--tj-imminent)' : 'var(--tj-accent,#12a594)'}`,
    'flex-shrink:0',
  ].join(';')
  return blip
}

// React 컴포넌트 버전은 어디서도 쓰이지 않아 제거했다. 지도 마커는 아래
// create*Element 계열이 만드는 DOM 노드를 kakao CustomOverlay에 넣어 그린다.

// ─────────────────────────────────────────────────────────────
// createMarkerChipElement — kakao CustomOverlay 용
// 시안1: pill(999px) · [dot | name | live/sub] + tail
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
}) {
  const color = resolveColor(routeCode, routeColor)
  const hasLive = showLive && liveMinutes != null
  const imminentEta = hasLive && isImminent(liveMinutes)
  const dotText = badgeText ?? (routeCode ?? '').slice(0, 2)

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
      'background:var(--tj-delayed)',
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

  // 칩 본체: pill(시안1)
  const chip = document.createElement('div')
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:7px',
    'background:var(--tj-surface)',
    'border:1px solid var(--tj-line)',
    'border-radius:999px',
    'padding:5px 11px 5px 5px',
    'box-shadow:0 3px 10px rgba(27,42,74,.12)',
    'user-select:none',
    'white-space:nowrap',
  ].join(';')

  // dot 배지
  chip.appendChild(makeDot({ color, text: dotText }))

  // .name: 정류장명 (ink, 14px)
  const nameEl = document.createElement('span')
  nameEl.setAttribute('data-role', 'name')
  nameEl.style.cssText = [
    'font-size:14px',
    'font-weight:700',
    'color:var(--tj-ink)',
    'letter-spacing:-0.01em',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';')
  nameEl.textContent = stationName
  chip.appendChild(nameEl)

  // 실시간 or 서브레이블
  if (hasLive) {
    const liveEl = document.createElement('span')
    liveEl.setAttribute('data-role', 'live')
    liveEl.style.cssText = [
      'font-size:14px',
      'font-weight:800',
      `color:${imminentEta ? 'var(--tj-imminent)' : 'var(--tj-ink)'}`,
      'display:inline-flex',
      'align-items:center',
      'gap:4px',
      'font-variant-numeric:tabular-nums',
    ].join(';')

    liveEl.appendChild(makeBlip(imminentEta))

    const liveText = liveMinutes <= 3 ? '곧 도착' : `${liveMinutes}분`
    const textSpan = document.createElement('span')
    textSpan.textContent = liveText
    liveEl.appendChild(textSpan)

    if (inaccurate) {
      const tag = document.createElement('span')
      tag.style.cssText = [
        'margin-left:5px',
        'font-size:13px',
        'font-weight:700',
        'color:var(--tj-imminent)',
        'background:var(--tj-imminent-bg)',
        'border-radius:8px',
        'padding:1px 5px',
      ].join(';')
      tag.textContent = '부정확'
      liveEl.appendChild(tag)
    }

    chip.appendChild(liveEl)
  } else {
    const subEl = document.createElement('span')
    subEl.setAttribute('data-role', 'sub')
    subEl.style.cssText = [
      'font-size:13px',
      'color:var(--tj-mute,#868e8b)',
      'font-variant-numeric:tabular-nums',
    ].join(';')
    subEl.textContent = subLabel ?? '시간표'
    chip.appendChild(subEl)
  }

  wrapper.appendChild(chip)
  wrapper.appendChild(makeTail())

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}

// ─────────────────────────────────────────────────────────────
// createSubwayMultiChipElement — 정왕역 수인분당·4호선 시안1
// pill · [dot "철" | name "정왕역" | live 가장 빠른 도착]
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

  // 칩 본체: pill
  const chip = document.createElement('div')
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:7px',
    'background:var(--tj-surface)',
    'border:1px solid var(--tj-line)',
    'border-radius:999px',
    'padding:5px 11px 5px 5px',
    'box-shadow:0 3px 10px rgba(27,42,74,.12)',
    'user-select:none',
    'white-space:nowrap',
  ].join(';')

  // 가장 빠른 도착 계산 (up/down/line4_up/line4_down 중 최소)
  const KEYS = ['up', 'down', 'line4_up', 'line4_down']
  let earliestMin = null
  let earliestColor = '#F5A623'

  for (const key of KEYS) {
    const entry = subwayData?.[key]
    if (entry?.arrive_in_seconds != null) {
      const min = Math.max(0, Math.ceil(entry.arrive_in_seconds / 60))
      if (earliestMin === null || min < earliestMin) {
        earliestMin = min
        earliestColor = (key === 'line4_up' || key === 'line4_down') ? '#1B5FAD' : '#F5A623'
      }
    }
  }

  const imminentEta = isImminent(earliestMin)

  // dot 배지
  chip.appendChild(makeDot({ color: earliestColor, text: '철' }))

  // name: 정왕역
  const nameEl = document.createElement('span')
  nameEl.setAttribute('data-role', 'name')
  nameEl.style.cssText = [
    'font-size:14px',
    'font-weight:700',
    'color:var(--tj-ink)',
    'letter-spacing:-0.01em',
  ].join(';')
  nameEl.textContent = '정왕역'
  chip.appendChild(nameEl)

  // live: 가장 빠른 도착
  const liveEl = document.createElement('span')
  liveEl.setAttribute('data-role', 'live')
  liveEl.style.cssText = [
    'font-size:14px',
    'font-weight:800',
    `color:${imminentEta ? 'var(--tj-imminent)' : (earliestMin != null ? 'var(--tj-ink)' : 'var(--tj-mute,#868e8b)')}`,
    'display:inline-flex',
    'align-items:center',
    'gap:4px',
    'font-variant-numeric:tabular-nums',
  ].join(';')

  if (earliestMin != null) {
    liveEl.appendChild(makeBlip(imminentEta))
    const textSpan = document.createElement('span')
    textSpan.textContent = earliestMin <= 3 ? '곧 도착' : `${earliestMin}분`
    liveEl.appendChild(textSpan)
  } else {
    const textSpan = document.createElement('span')
    textSpan.textContent = '·'
    liveEl.appendChild(textSpan)
  }

  chip.appendChild(liveEl)
  wrapper.appendChild(chip)
  wrapper.appendChild(makeTail())

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}

// ─────────────────────────────────────────────────────────────
// createClusterBadgeElement — 겹치는 마커 그룹을 대체하는 클러스터 배지 (시안 v3, 사용자 확정).
// 화면 픽셀 거리가 가까운 station 2개 이상을 개별 칩/닷 대신 이 배지 하나로
// 표시한다(ZoomAwareOverlayManager.jsx의 clusterStations 그룹화 결과 소비).
// 탭 시 MarkerSheet를 열지 않고 해당 위치로 줌인해 겹침을 해소한다.
// 스택형 카드 겹침: 그룹 멤버 노선색(최대 3개)을 살짝 겹친 원으로 쌓아
// "정류장 여러 개가 여기 있다"를 색으로 직접 보여주고, 우하단 숫자 배지로 정확한 개수를 표시.
// ─────────────────────────────────────────────────────────────

const CLUSTER_CARD_POSITIONS = [
  { left: 0,  top: 4 },
  { left: 10, top: 0 },
  { left: 20, top: 4 },
]

export function createClusterBadgeElement({ count, colors = [], onClick }) {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-role', 'cluster-badge')
  wrapper.style.cssText = ['position:relative', 'width:44px', 'height:34px', 'cursor:pointer'].join(';')

  const shown = colors.length ? colors.slice(0, 3) : [DEFAULT_COLOR]
  shown.forEach((color, i) => {
    const pos = CLUSTER_CARD_POSITIONS[i] ?? CLUSTER_CARD_POSITIONS[CLUSTER_CARD_POSITIONS.length - 1]
    const card = document.createElement('span')
    card.style.cssText = [
      'position:absolute',
      `left:${pos.left}px`,
      `top:${pos.top}px`,
      'width:26px',
      'height:26px',
      'border-radius:50%',
      `background:${color}`,
      'border:2px solid var(--tj-surface)',
      'box-shadow:0 2px 6px rgba(0,0,0,.18)',
      `z-index:${i + 1}`,
    ].join(';')
    wrapper.appendChild(card)
  })

  const countBadge = document.createElement('span')
  countBadge.style.cssText = [
    'position:absolute',
    'right:-5px',
    'bottom:-5px',
    'z-index:4',
    'width:20px',
    'height:20px',
    'border-radius:50%',
    'background:var(--tj-ink)',
    'color:var(--tj-bg)',
    'font-size:12px',
    'font-weight:800',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'border:2px solid var(--tj-surface)',
  ].join(';')
  countBadge.textContent = String(count)
  wrapper.appendChild(countBadge)

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}

// ─────────────────────────────────────────────────────────────
// createSeohaeSiheungChipElement — 시흥시청역 서해선 시안1
// pill · [dot "철" 서해선색 | name | live 상행N분]
// ─────────────────────────────────────────────────────────────

export function createSeohaeSiheungChipElement({ stationName, upMinutes, dnMinutes, onClick }) {
  const SEOHAE = '#75bf43'

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:relative',
    'display:inline-flex',
    'flex-direction:column',
    'align-items:center',
    'cursor:pointer',
  ].join(';')

  // 칩 본체: pill
  const chip = document.createElement('div')
  chip.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:7px',
    'background:var(--tj-surface)',
    'border:1px solid var(--tj-line)',
    'border-radius:999px',
    'padding:5px 11px 5px 5px',
    'box-shadow:0 3px 10px rgba(27,42,74,.12)',
    'user-select:none',
    'white-space:nowrap',
  ].join(';')

  // dot 배지: 서해선 색
  chip.appendChild(makeDot({ color: SEOHAE, text: '철' }))

  // name: 역명
  const nameEl = document.createElement('span')
  nameEl.setAttribute('data-role', 'name')
  nameEl.style.cssText = [
    'font-size:14px',
    'font-weight:700',
    'color:var(--tj-ink)',
    'letter-spacing:-0.01em',
  ].join(';')
  nameEl.textContent = stationName
  chip.appendChild(nameEl)

  // live: 상행 가장 가까운 도착 (upMinutes 우선, 없으면 dnMinutes)
  const bestMin = upMinutes ?? dnMinutes
  const imminentEta = isImminent(bestMin)

  const liveEl = document.createElement('span')
  liveEl.setAttribute('data-role', 'live')
  liveEl.style.cssText = [
    'font-size:14px',
    'font-weight:800',
    `color:${imminentEta ? 'var(--tj-imminent)' : (bestMin != null ? 'var(--tj-ink)' : 'var(--tj-mute,#868e8b)')}`,
    'display:inline-flex',
    'align-items:center',
    'gap:4px',
    'font-variant-numeric:tabular-nums',
  ].join(';')

  if (bestMin != null) {
    liveEl.appendChild(makeBlip(imminentEta))
    const textSpan = document.createElement('span')
    textSpan.textContent = bestMin <= 3 ? '곧 도착' : `${bestMin}분`
    liveEl.appendChild(textSpan)
  } else {
    const textSpan = document.createElement('span')
    textSpan.textContent = '·'
    liveEl.appendChild(textSpan)
  }

  chip.appendChild(liveEl)
  wrapper.appendChild(chip)
  wrapper.appendChild(makeTail())

  if (onClick) wrapper.addEventListener('click', onClick)
  return wrapper
}
