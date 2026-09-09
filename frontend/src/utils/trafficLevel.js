/**
 * trafficLevel.js — 도로 소통 단계의 단일 출처.
 *
 * 같은 규칙이 네 곳에 복사돼 있었고, 그중 지도만 낱말이 하나 더 많았다.
 * TrafficFlowCard.speedStatus / StatusChips.trafficStatus / FlowChart.classifySpeed
 * 는 25·15 km/h 로 3단계(원활·서행·정체)를 냈고, map/trafficLevels.js 는
 * 백엔드가 보내는 혼잡 코드 1~4 를 그대로 받아 4단계(원활·서행·지체·정체)를
 * 썼다. 같은 도로가 지도에서는 "지체", 카드에서는 "서행" 으로 보였다.
 *
 * 이 모듈이 그 넷을 대체한다. 판정 입력은 언제나 속도(km/h) 하나다. 백엔드의
 * congestion 코드는 임계값이 다르므로(40/20/10) 표시에 쓰지 않는다 — 두
 * 임계표를 하나로 합치는 것은 사용자에게 알려 주는 도로 상태가 달라지는
 * 결정이라 여기서 임의로 바꾸지 않는다.
 */

/** 단계 경계(km/h). 이 값이 화면에 보이는 모든 도로 낱말을 정한다. */
export const SPEED_THRESHOLDS = {
  smooth: 25,
  slow: 15,
}

/**
 * 단계 정의. tone 은 상태 3색 토큰이고, color 는 지도처럼 DOM style 로 색을
 * 직접 넣어야 하는 자리에서 쓴다. 색을 두 곳에서 따로 정하지 않는다.
 */
export const TRAFFIC_LEVELS = [
  { key: 'smooth', label: '원활', tone: 'ease',     cls: 'text-ease',     color: 'var(--tj-ease)' },
  { key: 'slow',   label: '서행', tone: 'imminent', cls: 'text-imminent', color: 'var(--tj-imminent)' },
  { key: 'jam',    label: '정체', tone: 'delayed',  cls: 'text-delayed',  color: 'var(--tj-delayed)' },
]

const BY_KEY = Object.fromEntries(TRAFFIC_LEVELS.map((l) => [l.key, l]))

/**
 * 속도 → 단계. 속도를 모르면 null 이다(칩을 그리지 말라는 신호).
 *
 * @param {number|null|undefined} kmh
 * @returns {{key:string,label:string,tone:string,cls:string,color:string}|null}
 */
export function trafficLevelFromSpeed(kmh) {
  if (kmh == null || Number.isNaN(kmh)) return null
  if (kmh >= SPEED_THRESHOLDS.smooth) return BY_KEY.smooth
  if (kmh >= SPEED_THRESHOLDS.slow) return BY_KEY.slow
  return BY_KEY.jam
}

/** 속도 → 낱말. 모르면 null. */
export function trafficLabelFromSpeed(kmh) {
  return trafficLevelFromSpeed(kmh)?.label ?? null
}
