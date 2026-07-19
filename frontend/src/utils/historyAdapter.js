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
 * 반환 형태 (rows):
 *   [
 *     { key: 'yesterday', items: [{ time: 'HH:MM', position: 'past'|'closest'|'after' }, ...] },
 *     { key: 'dayBefore', items: [...] },
 *     { key: 'lastWeek',  items: [...] },
 *   ]
 *
 * 설계 원칙:
 *   - today(예정) 시각은 절대 포함하지 않는다. 사용자가 직접 예측하게 한다.
 *   - delta(예측 비교 verdict)는 제공하지 않는다.
 *   - 각 컬럼(어제/이틀 전/7일 전)은 서로 독립적으로 selectHistoryWindow를 적용한다.
 *     날짜별 기록 개수가 달라도 컬럼마다 자기 자신의 창(최대 6건)을 갖는다.
 *   - yesterday: columns[0] (어제)
 *   - dayBefore: columns[1] (이틀 전)
 *   - lastWeek:  columns[2] (7일 전)
 */

const COLUMN_KEYS = ['yesterday', 'dayBefore', 'lastWeek']

// 기본 윈도우 구성: 가장 가까운 기록(closest) 기준 이전 2건 + 이후 3건, 최대 6건.
const DEFAULT_BEFORE_COUNT = 2
const DEFAULT_AFTER_COUNT = 3
const DEFAULT_MAX_WINDOW = 6

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

// records의 각 항목을 { ...원본, time, min } 형태로 정규화한다.
// 항목이 문자열("HH:MM")이면 { time }으로 감싸고, 객체면 원본 필드를 보존한 채 time을 확정한다.
// 파싱 불가능한 항목은 제거한다.
function normalizeRecords(records) {
  return records
    .map((record) => {
      const time = typeof record === 'string' ? record : record?.time
      const min = hhmm2min(time)
      if (min === null) return null
      const base = typeof record === 'string' ? { time } : { ...record, time }
      return { ...base, min }
    })
    .filter(Boolean)
    .sort((a, b) => a.min - b.min)
}

/**
 * selectHistoryWindow(records, now, options) — 순수 함수.
 *
 * records(하루치 도착 시각 목록)에서, now의 하루 중 시각(minutes of day)과 가장 가까운
 * 기록 1건을 closest로 잡고, 그 이전 beforeCount건 + 이후 afterCount건까지(최대
 * maxWindow건) 윈도우를 반환한다.
 *
 * - 기록이 부족하면 있는 만큼만 반환한다(패딩 없음).
 * - 전부 now보다 이전이거나 전부 이후인 경우에도 자연스럽게 동작한다(부족한 쪽은 그냥 비게 됨).
 * - 자정 부근은 minutes-of-day 절대차로 단순 비교한다(자정 넘김 순환 보정 없음).
 * - 동률(diff가 같은 두 기록)이면 더 이른 시각을 closest로 선택한다.
 *
 * @param {Array<string|{time:string}>} records - 하루치 도착 시각 목록("HH:MM" 문자열 또는 { time } 객체)
 * @param {Date} now - 기준 시각
 * @param {{ beforeCount?: number, afterCount?: number, maxWindow?: number }} [options]
 * @returns {Array<object>} - [{ ...record, time, position: 'past'|'closest'|'after' }, ...] (최대 maxWindow건)
 */
export function selectHistoryWindow(records, now, options = {}) {
  const beforeCount = options.beforeCount ?? DEFAULT_BEFORE_COUNT
  const afterCount = options.afterCount ?? DEFAULT_AFTER_COUNT
  const maxWindow = options.maxWindow ?? DEFAULT_MAX_WINDOW

  if (!Array.isArray(records) || records.length === 0) return []

  const normalized = normalizeRecords(records)
  if (normalized.length === 0) return []

  const nowMin = dateToMin(now instanceof Date ? now : new Date())

  let closestIdx = 0
  let closestDiff = Infinity
  normalized.forEach((entry, idx) => {
    const diff = Math.abs(entry.min - nowMin)
    if (diff < closestDiff) {
      closestDiff = diff
      closestIdx = idx
    }
  })

  const startIdx = Math.max(0, closestIdx - beforeCount)
  const endIdx = Math.min(normalized.length - 1, closestIdx + afterCount)

  const window = []
  for (let i = startIdx; i <= endIdx && window.length < maxWindow; i++) {
    const position = i < closestIdx ? 'past' : i === closestIdx ? 'closest' : 'after'
    const { min: _min, ...rest } = normalized[i]
    window.push({ ...rest, position })
  }

  return window
}

/**
 * toHistoryRows(preview, now?) — 순수 변환 함수.
 *
 * @param {object} preview - history-preview API 응답
 * @param {Date}   now     - 현재 시각 (테스트 주입용, 기본값 new Date())
 * @returns {Array}        - 컬럼별 윈도우 rows. 모든 컬럼이 비어 있으면 []
 */
export function toHistoryRows(preview, now) {
  if (!preview) return []

  const { columns } = preview
  if (!Array.isArray(columns) || columns.length === 0) return []

  const nowDate = now instanceof Date ? now : new Date()

  const rows = COLUMN_KEYS.map((key, i) => {
    const col = columns[i] ?? null
    const times = Array.isArray(col?.times) ? col.times : []
    const items = selectHistoryWindow(times, nowDate)
    return { key, items }
  })

  const hasAny = rows.some((col) => col.items.length > 0)
  if (!hasAny) return []

  return rows
}

/**
 * formatHHMMFromDate(date) — Date를 "HH:MM" 문자열로 변환.
 * dateToMin과 동일하게 Date의 로컬 시각을 그대로 사용한다(이 모듈 전체의 관례와 일치).
 *
 * @param {Date} date
 * @returns {string} - "HH:MM"
 */
export function formatHHMMFromDate(date) {
  const d = date instanceof Date ? date : new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
