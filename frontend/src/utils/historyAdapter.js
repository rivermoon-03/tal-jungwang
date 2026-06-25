/**
 * historyAdapter.js
 *
 * history-preview API 응답 → ArrivalHistory 컴포넌트 props(rows) 변환 유틸.
 *
 * API 응답 형태:
 *   {
 *     columns: [
 *       { label: '어제',    date, day_label, times: string[], totalCount },
 *       { label: '이틀 전', date, day_label, times: string[], totalCount },
 *       { label: '7일 전',  date, day_label, times: string[], totalCount },
 *     ],
 *     realtime_eta: { primary: { arrive_at_hhmm }, secondary } | null,
 *     predicted_eta: { hhmm, sample_size, day_label } | null,
 *   }
 *
 * 반환 형태:
 *   [{ slot, yesterday, dayBefore, lastWeek, delta: null }]
 *
 * 설계 원칙:
 *   - today(예정) 시각은 절대 포함하지 않는다. 사용자가 직접 예측하게 한다.
 *   - delta(예측 비교 verdict)는 제공하지 않는다.
 *   - now(현재 시각) 기준으로 각 컬럼에서 now 이후 시각만 필터링 후 최대 2개 행 생성.
 *   - yesterday: columns[0] (어제)
 *   - dayBefore: columns[1] (이틀 전)
 *   - lastWeek:  columns[2] (7일 전)
 */

// "HH:MM" → 총 분 (파싱 실패 시 null)
function hhmm2min(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const parts = hhmm.split(':')
  if (parts.length !== 2) return null
  const hh = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10)
  if (isNaN(hh) || isNaN(mm)) return null
  return hh * 60 + mm
}

// Date → 총 분 (시*60 + 분)
function dateToMin(date) {
  return date.getHours() * 60 + date.getMinutes()
}

// 컬럼 times 배열에서 nowMin 이후(>=) 시각만 필터링하여 반환
function filterFromNow(times, nowMin) {
  if (!Array.isArray(times)) return []
  return times.filter((t) => {
    const m = hhmm2min(t)
    return m !== null && m >= nowMin
  })
}

/**
 * toHistoryRows(preview, now?) — 순수 변환 함수.
 *
 * @param {object} preview - history-preview API 응답
 * @param {Date}   now     - 현재 시각 (테스트 주입용, 기본값 new Date())
 * @returns {Array}        - ArrivalHistory rows (최대 2개)
 */
export function toHistoryRows(preview, now) {
  if (!preview) return []

  const { columns } = preview

  if (!Array.isArray(columns) || columns.length === 0) return []

  // 현재 시각 총 분 계산
  const nowMin = dateToMin(now instanceof Date ? now : new Date())

  // 어제(columns[0]) / 이틀 전(columns[1]) / 7일 전(columns[2]) 에서 now 이후 시각만 필터링
  const col0 = columns[0]
  const col1 = columns[1] ?? null
  const col2 = columns[2] ?? null

  const times0 = filterFromNow(col0?.times, nowMin)
  const times1 = filterFromNow(col1?.times, nowMin)
  const times2 = filterFromNow(col2?.times, nowMin)

  // now 이후 시각이 모든 컬럼에 없으면 빈 배열 반환
  if (times0.length === 0 && times1.length === 0 && times2.length === 0) return []

  // 슬롯 수: 최대 2개 제한 (현재 시각 근처 1~2개)
  const slotCount = Math.min(Math.max(times0.length, times1.length, times2.length, 1), 2)

  const rows = []
  for (let i = 0; i < slotCount; i++) {
    const yesterday = times0[i] ?? null
    const dayBefore = times1[i] ?? null
    const lastWeek = times2[i] ?? null

    rows.push({
      slot: yesterday ?? dayBefore ?? lastWeek ?? `slot-${i}`,
      yesterday,
      dayBefore,
      lastWeek,
      delta: null,       // delta verdict 제거
    })
  }

  return rows
}
