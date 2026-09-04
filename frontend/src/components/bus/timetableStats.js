/**
 * timetableStats.js — 노선 상세 페이지 ② 시간표 섹션 전용 순수 계산 유틸.
 *
 * RouteDetailPage가 시간표 원시 데이터(출발 시각 문자열 배열)로부터
 * "첫차 / 막차 / 배차(간격 min~max)" 3타일 요약과, 전체 시간표 펼침 뷰에서
 * 시간대별로 묶어 보여줄 그룹을 계산한다. 표시 정책(단위 테스트로 고정해야
 * 회귀를 막을 수 있는 로직)이라 컴포넌트에 인라인하지 않고 이 모듈에 모은다
 * (mistakes.md §2 — 인라인 복붙이 회귀의 근원).
 *
 * 배차 간격은 인접 출발 간 분 차이를 전부 모아 min~max로 보여주는데, 운행이
 * 끊기는 심야 공백(예: 00:30 다음 차가 07:00)도 그대로 섞이면 "15~390분"처럼
 * 실제 배차와 무관한 값이 나온다. detectGapIndices가 그 공백을 통계적으로
 * 골라내 interval 계산에서 빼고, 뺀 구간은 overnightGaps로 따로 돌려준다.
 */

// "HH:MM" → 하루 중 분(0~1439). 파싱 실패 시 null.
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * computeGapFence(diffValues) — 주어진 간격 집합에서 "이보다 크면 공백"으로
 * 볼 하한선(fence)을 데이터에서 끌어낸다.
 *
 * Tukey의 극단치 기준(Q3 + 3×IQR, boxplot의 "far out" 경계)을 기본으로 쓴다.
 * 다만 배차가 25분으로 거의 규칙적인 노선은 사분위수 대부분이 같은 값이라
 * IQR이 0에 가까워지고, 그러면 기준이 Q3(=25분 안팎)로 주저앉아 30분 같은
 * 정상 변동까지 공백으로 오인한다. Q3의 3배를 바닥값으로 같이 걸어 이 경우를
 * 막는다.
 *
 * @param {number[]} diffValues
 * @returns {number} 이 값을 초과하는 간격은 공백 후보로 본다.
 */
function computeGapFence(diffValues) {
  if (diffValues.length === 0) return Infinity
  const sorted = [...diffValues].sort((a, b) => a - b)
  const quantile = (p) => {
    const idx = (sorted.length - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi) return sorted[lo]
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  const q1 = quantile(0.25)
  const q3 = quantile(0.75)
  const iqr = q3 - q1
  return Math.max(q3 + 3 * iqr, q3 * 3)
}

/**
 * detectGapIndices(diffValues) — diffValues 중 심야 운행 공백으로 볼 항목의
 * 인덱스 집합을 고른다.
 *
 * 최댓값 하나를 "공백 후보"로 뽑아, 그 후보를 뺀 나머지로만 fence를 계산해
 * 후보가 스스로 기준선을 끌어올리는 자기잠식을 막는다(후보를 포함해서 사분위수를
 * 구하면, 표본이 적을수록 Q3가 후보 쪽으로 끌려가 fence가 후보값 바로 위까지
 * 벌어져 절대 못 걸러낸다 — 시각 5개짜리 표본으로 재현 확인). 후보가 fence를
 * 넘으면 공백으로 확정하고 빼낸 뒤 다음 최댓값으로 반복한다. 남은 값이 1개면
 * 더 뺄 근거가 없으니 멈춘다.
 *
 * @param {number[]} diffValues
 * @returns {Set<number>} diffValues 안에서 공백으로 분류된 원소들의 인덱스.
 */
function detectGapIndices(diffValues) {
  const remaining = diffValues.map((v, i) => ({ v, i }))
  const gapIndices = new Set()
  while (remaining.length > 1) {
    let maxAt = 0
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i].v > remaining[maxAt].v) maxAt = i
    }
    const candidate = remaining[maxAt]
    const rest = remaining.filter((_, i) => i !== maxAt).map((e) => e.v)
    if (candidate.v <= computeGapFence(rest)) break
    gapIndices.add(candidate.i)
    remaining.splice(maxAt, 1)
  }
  return gapIndices
}

/**
 * computeTimetableSummary(times) — 첫차/막차/배차 간격 계산.
 *
 * @param {string[]} times - "HH:MM" 출발 시각 목록(정렬 여부 무관, 내부에서 정렬)
 * @returns {{
 *   firstBus: string, lastBus: string, count: number,
 *   interval: {min:number,max:number}|null,
 *   overnightGaps: Array<{from:string,to:string,minutes:number}>,
 * } | null}
 *   - times가 비어 있으면 null.
 *   - interval은 심야 운행 공백(detectGapIndices가 골라낸 간격)을 뺀 나머지
 *     인접 출발 간 분 간격의 최소~최대다. 시각이 1개뿐이라 간격 자체가 없으면
 *     null. detectGapIndices는 표본에서 최소 하나는 항상 남기므로(가장 큰
 *     값만 반복해서 후보로 검사하고, 남은 값이 1개면 멈춘다) 전부가 공백으로
 *     잡혀 interval이 null이 되는 경우는 없다.
 *   - overnightGaps는 공백으로 분류돼 interval 계산에서 빠진 구간 목록이다.
 *     그런 구간이 없으면 빈 배열이다.
 */
export function computeTimetableSummary(times) {
  if (!Array.isArray(times) || times.length === 0) return null

  const valid = times
    .filter((t) => toMinutes(t) != null)
    .sort((a, b) => toMinutes(a) - toMinutes(b))

  if (valid.length === 0) return null

  const mins = valid.map(toMinutes)
  const diffEntries = []
  for (let i = 1; i < mins.length; i++) {
    const d = mins[i] - mins[i - 1]
    if (d > 0) diffEntries.push({ from: valid[i - 1], to: valid[i], minutes: d })
  }

  const gapAt = detectGapIndices(diffEntries.map((e) => e.minutes))
  const regularEntries = diffEntries.filter((_, i) => !gapAt.has(i))
  const gapEntries = diffEntries.filter((_, i) => gapAt.has(i))

  const regularMinutes = regularEntries.map((e) => e.minutes)

  return {
    firstBus: valid[0],
    lastBus: valid[valid.length - 1],
    count: valid.length,
    interval:
      regularMinutes.length > 0
        ? { min: Math.min(...regularMinutes), max: Math.max(...regularMinutes) }
        : null,
    overnightGaps: gapEntries.map((e) => ({ from: e.from, to: e.to, minutes: e.minutes })),
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
