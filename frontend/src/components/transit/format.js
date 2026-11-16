// 교통 화면 공용 표시 규칙. 숫자 해석을 한 곳에서만 한다.
import { IMMINENT_LABEL, IMMINENT_THRESHOLD_SEC } from '../../utils/eta'

export const SOON_SEC = 180
export const ARRIVING_LABEL = `${IMMINENT_LABEL} 도착`

/** 남은 초 → 임박 문구 또는 N분 */
export function minutesLabel(sec) {
  if (sec == null) return null
  if (sec <= IMMINENT_THRESHOLD_SEC) return ARRIVING_LABEL
  return `${Math.round(sec / 60)}분`
}

export function isSoon(sec) {
  return sec != null && sec <= SOON_SEC
}

export function stopsLabel(n) {
  return n > 0 ? `${n}정거장 전` : null
}

/** "HH:MM" 또는 "HH:MM:SS" → 자정 기준 분 */
export function clockToMinutes(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function nowMinutes(now = new Date()) {
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60_000)
  return kst.getHours() * 60 + kst.getMinutes()
}

/** "HH:MM" 목록 → [{ hour, mins: [mm] }] (시간 순) */
export function groupByHour(times) {
  const map = new Map()
  for (const t of times ?? []) {
    const m = clockToMinutes(t)
    if (m == null) continue
    const hour = Math.floor(m / 60)
    if (!map.has(hour)) map.set(hour, [])
    map.get(hour).push({ min: m % 60, total: m, raw: t })
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([hour, mins]) => ({ hour, mins }))
}

/** 평소 대비 차이(분, +는 늦음) → 사람 말 */
export function delayVerdict(deltaMin) {
  if (deltaMin == null) return null
  const a = Math.abs(deltaMin)
  if (a <= 2) return '평소와 비슷해요'
  const dir = deltaMin > 0 ? '늦어요' : '빨라요'
  return `평소보다 ${a <= 5 ? '조금' : '많이'} ${dir}`
}

/**
 * 오늘 도착 예정 시각을 지난 같은 요일들의 가장 가까운 도착과 비교한다.
 * 30분 안에 짝이 있는 날이 2개 이상일 때만 중앙값을 낸다.
 */
export function historyDelta(columns, etaSec, nowMin) {
  if (etaSec == null || !columns?.length) return null
  const target = nowMin + Math.round(etaSec / 60)
  const deltas = []
  for (const col of columns) {
    let best = null
    for (const t of col.times ?? []) {
      const m = clockToMinutes(t)
      if (m == null) continue
      if (best == null || Math.abs(target - m) < Math.abs(target - best)) best = m
    }
    if (best != null && Math.abs(target - best) <= 30) deltas.push(target - best)
  }
  if (deltas.length < 2) return null
  const s = [...deltas].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** times 중 nowMin 과 가장 가까운 시각. 같으면 앞선 시각 */
export function nearestTime(times, nowMin) {
  let best = null
  let bestGap = Infinity
  for (const t of times ?? []) {
    const m = clockToMinutes(t)
    if (m == null) continue
    const gap = Math.abs(m - nowMin)
    if (gap < bestGap) {
      best = t
      bestGap = gap
    }
  }
  return best
}
