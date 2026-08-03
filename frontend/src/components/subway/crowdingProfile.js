// 시간대 혼잡 프로파일 (B4) 순수 계산 헬퍼.
// 컴포넌트 파일(SubwayCrowdingChart.jsx)이 순수 함수까지 export 하면 Fast Refresh
// 규칙 위반이라 분리했다 — realtimeFreshness.js 와 같은 관례(subway 디렉터리 로컬 .js).

// 표시 범위: 06~23시. 심야 00~05시는 운행이 거의 없어 축만 늘리므로 자른다.
export const CROWDING_HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

// "여유" 판정 임계 — level 이 이 값 아래로 내려가는 첫 시각을 결론 문장에 쓴다.
export const RELAXED_THRESHOLD = 0.4

/**
 * API 응답([{hour, level}])을 표시 범위(06~23시)의 연속 배열로 편다.
 * 빠진 시간대는 level 0 으로 채운다 (막대 스텁만 그려져 축이 이어져 보인다).
 *
 * @param {Array<{hour:number, level:number}>|null|undefined} items
 * @returns {Array<{hour:number, level:number}>}
 */
export function toDisplayLevels(items) {
  const byHour = new Map(
    (Array.isArray(items) ? items : []).map((it) => [it.hour, it.level])
  )
  return CROWDING_HOURS.map((hour) => ({ hour, level: byHour.get(hour) ?? 0 }))
}

/**
 * 결론 한 줄용 요약 계산.
 * - peakHour: 표시 범위 내 level 최고 시간대 (동률이면 이른 쪽).
 * - relaxedHour: 현재 시각 이후 level 이 RELAXED_THRESHOLD 아래로 내려가는
 *   첫 시각. 없으면 null (문장에서 "— M시 이후 여유" 생략).
 *
 * @param {Array<{hour:number, level:number}>} levels  toDisplayLevels 결과
 * @param {number} currentHour  0~23
 * @returns {{peakHour:number|null, relaxedHour:number|null, maxLevel:number}}
 */
export function summarizeCrowding(levels, currentHour) {
  let peakHour = null
  let maxLevel = 0
  for (const { hour, level } of levels) {
    if (level > maxLevel) {
      maxLevel = level
      peakHour = hour
    }
  }

  let relaxedHour = null
  for (const { hour, level } of levels) {
    if (hour > currentHour && level < RELAXED_THRESHOLD) {
      relaxedHour = hour
      break
    }
  }

  return { peakHour, relaxedHour, maxLevel }
}
