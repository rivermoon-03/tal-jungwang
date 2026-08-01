/**
 * timetableStats.js — 노선 상세 페이지 ② 시간표 섹션 전용 순수 계산 유틸.
 *
 * RouteDetailPage가 시간표 원시 데이터(출발 시각 문자열 배열)로부터
 * "첫차 / 막차 / 배차(간격 min~max)" 3타일 요약과, 전체 시간표 펼침 뷰에서
 * 시간대별로 묶어 보여줄 그룹을 계산한다. 표시 정책(단위 테스트로 고정해야
 * 회귀를 막을 수 있는 로직)이라 컴포넌트에 인라인하지 않고 이 모듈에 모은다
 * (mistakes.md §2 — 인라인 복붙이 회귀의 근원).
 */

// "HH:MM" → 하루 중 분(0~1439). 파싱 실패 시 null.
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * computeTimetableSummary(times) — 첫차/막차/배차 간격 계산.
 *
 * @param {string[]} times - "HH:MM" 출발 시각 목록(정렬 여부 무관, 내부에서 정렬)
 * @returns {{ firstBus: string, lastBus: string, count: number, interval: {min:number,max:number}|null } | null}
 *   - times가 비어 있으면 null.
 *   - interval은 인접 출발 간 분 간격의 최소~최대. 시각이 1개뿐이면(간격 계산 불가) null.
 */
export function computeTimetableSummary(times) {
  if (!Array.isArray(times) || times.length === 0) return null

  const valid = times
    .filter((t) => toMinutes(t) != null)
    .sort((a, b) => toMinutes(a) - toMinutes(b))

  if (valid.length === 0) return null

  const mins = valid.map(toMinutes)
  const diffs = []
  for (let i = 1; i < mins.length; i++) {
    const d = mins[i] - mins[i - 1]
    if (d > 0) diffs.push(d)
  }

  return {
    firstBus: valid[0],
    lastBus: valid[valid.length - 1],
    count: valid.length,
    interval: diffs.length > 0 ? { min: Math.min(...diffs), max: Math.max(...diffs) } : null,
  }
}

/**
 * groupTimesByHour(times) — 전체 시간표 펼침 뷰용 시간대별 그룹.
 * "05"~"23" 등 시(hour) 문자열 단위로 묶고, 시 오름차순으로 정렬해 반환한다.
 *
 * @param {string[]} times
 * @returns {Array<{ hour: string, times: string[] }>}
 */
export function groupTimesByHour(times) {
  if (!Array.isArray(times)) return []
  const groups = new Map()
  for (const t of times) {
    if (toMinutes(t) == null) continue
    const hour = t.split(':')[0]
    if (!groups.has(hour)) groups.set(hour, [])
    groups.get(hour).push(t)
  }
  return [...groups.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([hour, list]) => ({ hour, times: list.sort() }))
}

/**
 * intervalLabel({min,max}) — "10~20분" / "15분" 형태의 표시 문자열.
 * @param {{min:number,max:number}|null} interval
 * @returns {string|null}
 */
export function intervalLabel(interval) {
  if (!interval) return null
  if (interval.min === interval.max) return `${interval.min}분`
  return `${interval.min}~${interval.max}분`
}
