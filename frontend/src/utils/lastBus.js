/**
 * lastBus.js — "오늘 시간표"에서 막차 임박 여부를 판정하는 헬퍼.
 *
 * CLAUDE.md 규칙: 시각 비교는 항상 tz-aware하게, 문자열 사전순 비교 금지, 자정
 * 넘김(wraparound)을 고려한다. `now`는 KST 라벨(getKstHourMinuteLabel)로 뽑아
 * 브라우저 로컬 타임존과 무관하게 비교한다(timeOfDay.js와 동일 패턴).
 */
import { getKstHourMinuteLabel } from './timeOfDay.js'

// "HH:MM" → 하루 중 분(0~1439). 파싱 실패 시 null.
function toMinutes(hhmm) {
  // null/undefined/빈 문자열을 그대로 split하면 Number('')가 0으로 캐스팅돼
  // "자정(0분)"으로 잘못 해석될 수 있다 — 콜론 포함 문자열인지 먼저 확인한다.
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * 오늘 시간표(entries)에서 막차 항목을 찾는다.
 * `is_last: true`로 명시된 항목을 우선하고(RouteDetailPage 등 어댑터가 이미
 * 마지막 행에 표시해 둔다), 없으면 배열의 마지막 원소를 막차로 간주한다.
 */
function findLastEntry(entries) {
  const marked = entries.find((e) => e?.is_last === true)
  return marked ?? entries[entries.length - 1]
}

/**
 * 해당 노선의 오늘 시간표에서 막차 상태를 판정한다.
 *
 * @param {Array<{depart_at: string, is_last?: boolean}>} entries 오늘 시간표
 * @param {Date} [now=new Date()]
 * @returns {{ isLast: boolean, departure: string|null, minutesLeft: number|null }}
 *   - isLast: 막차가 아직 출발하지 않았으면 true(이미 지났거나 판정 불가면 false)
 *   - departure: 막차 출발 시각("HH:MM"). 판정 불가면 null
 *   - minutesLeft: 막차 출발까지 남은 분(음수 없음). 판정 불가/이미 출발했으면 null
 *
 * 렌더 여부(예: 30분 이내에만 배너 노출)는 호출부가 minutesLeft로 판단한다 —
 * 이 헬퍼는 사실만 계산하고 표시 임계값은 갖지 않는다.
 */
export function getLastBusStatus(entries, now = new Date()) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { isLast: false, departure: null, minutesLeft: null }
  }

  const lastEntry = findLastEntry(entries)
  const lastMin = toMinutes(lastEntry?.depart_at)
  if (lastMin == null) {
    return { isLast: false, departure: null, minutesLeft: null }
  }

  const nowMin = toMinutes(getKstHourMinuteLabel(now))

  // 자정 넘김 보정: 막차가 새벽 시간대(00:00~02:59)이고 현재가 밤 시간대(21:00~)면
  // 이미 지난 것처럼 오판(음수 diff)하지 않도록 막차 쪽에 +1440(하루)을 더해
  // 같은 연속선상에서 비교한다. (예: 23:50에 00:20 막차를 "20분 뒤"로 인식)
  const wraps = lastMin < 3 * 60 && nowMin >= 21 * 60
  const effectiveLastMin = wraps ? lastMin + 1440 : lastMin

  const minutesLeft = effectiveLastMin - nowMin
  if (minutesLeft < 0) {
    // 막차가 이미 출발함
    return { isLast: false, departure: lastEntry.depart_at, minutesLeft: null }
  }

  return { isLast: true, departure: lastEntry.depart_at, minutesLeft }
}
