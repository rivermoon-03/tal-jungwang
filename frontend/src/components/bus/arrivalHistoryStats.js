/**
 * arrivalHistoryStats.js — 노선 상세 페이지 ⑤ 도착 기록 섹션 전용 순수 계산 유틸.
 *
 * history-preview API의 columns(지난주/2주 전/3주 전, 같은 요일 실제 도착 시각 목록)에서
 * "지금 이 시간대엔 보통 N~M분 간격으로 왔다"를 계산한다. bus_arrival_stats
 * (arrival-stats API)의 mean_min은 하루 전체 평균이라 "이 시간대"를 반영하지
 * 못한다 — 이 모듈은 now 기준 windowMin 이내의 실제 기록만 골라 인접 간격을
 * 직접 계산한다(記錄에서 계산 — 결함 #30 요구사항).
 */

// "HH:MM" → 하루 중 분(0~1439). 파싱 실패 시 null.
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * computeHeadwayRangeMin(columns, now, windowMin) — 현재 시각대 실제 배차 간격.
 *
 * @param {Array<{times: string[]}>} columns - history-preview 응답의 columns
 * @param {Date} now - 기준 시각(테스트 주입용, 기본 new Date())
 * @param {number} [windowMin=90] - now 앞뒤로 볼 창(분). 각 날짜 컬럼 독립 적용.
 * @returns {{min:number, max:number}|null}
 *   - 간격을 계산할 수 없으면(자료 부족) null.
 */
export function computeHeadwayRangeMin(columns, now = new Date(), windowMin = 90) {
  if (!Array.isArray(columns) || columns.length === 0) return null

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const diffs = []

  for (const col of columns) {
    const times = Array.isArray(col?.times) ? col.times : []
    const mins = times
      .map(toMinutes)
      .filter((m) => m != null && Math.abs(m - nowMin) <= windowMin)
      .sort((a, b) => a - b)

    for (let i = 1; i < mins.length; i++) {
      const d = mins[i] - mins[i - 1]
      if (d > 0) diffs.push(d)
    }
  }

  if (diffs.length === 0) return null
  return { min: Math.min(...diffs), max: Math.max(...diffs) }
}

/**
 * headwayRangeLabel(range) — "N~M분 간격" / "N분 간격" 표시 문자열.
 * @param {{min:number,max:number}|null} range
 * @returns {string|null}
 */
export function headwayRangeLabel(range) {
  if (!range) return null
  if (range.min === range.max) return `${range.min}분 간격`
  return `${range.min}~${range.max}분 간격`
}
